import type { GovernedMemoryPermission, GovernedMemoryRole, GovernedMemoryTransitionType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLE_PERMISSIONS } from "@/lib/governed-memory/permissions";
import { buildCockpitPublicMemoryKey, buildTransitionFingerprint, fingerprintsEqual, normalizeTransitionRequestKey, transitionFinalStateLabel, verifyMemoryConcurrencyToken } from "./transition-idempotency";

type JourneyRole = Extract<GovernedMemoryRole, "MEMORY_STEWARD" | "MEMORY_DELEGATE">;
export type GovernedMemoryTransitionResult = { transition: GovernedMemoryTransitionType; applied: boolean; finalStateLabel: string };
export type GovernedMemoryTransitionErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "STATE_CONFLICT" | "TRANSITION_CONFLICT" | "ALREADY_APPLIED" | "GOVERNED_MEMORY_TRANSITION_FAILED";
export class GovernedMemoryTransitionError extends Error { constructor(readonly code: GovernedMemoryTransitionErrorCode) { super(code); this.name = "GovernedMemoryTransitionError"; } }

type Common = { requesterUserId: string; formTemplateId: string; requestKey: string };
type RoleInput = Common & { targetUserId: string; role: JourneyRole };
type ObjectInput = Common & { publicMemoryKey: string };
const allowedRoles: JourneyRole[] = ["MEMORY_STEWARD", "MEMORY_DELEGATE"];
const required = (value: unknown, max = 4000) => { if (typeof value !== "string") throw new GovernedMemoryTransitionError("INVALID_INPUT"); const normalized = value.trim(); if (!normalized || normalized.length > max || /<\/?[a-z][^>]*>/i.test(normalized)) throw new GovernedMemoryTransitionError("INVALID_INPUT"); return normalized; };
const retryWait = () => new Promise<void>((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 31)));
const prismaCode = (error: unknown, code: string) => Boolean(error && typeof error === "object" && "code" in error && error.code === code);

async function resolveOwner(database: PrismaClient | Prisma.TransactionClient, input: Common) {
  const root = await database.formTemplate.findFirst({ where: { id: input.formTemplateId, relationTemplate: { workspace: { ownerId: input.requesterUserId, status: "ACTIVE" } } }, select: { id: true, relationTemplate: { select: { id: true, workspaceId: true, governedJourney: { select: { id: true } } } } } });
  if (!root?.relationTemplate?.governedJourney) throw new GovernedMemoryTransitionError("NOT_FOUND");
  return { formTemplateId: root.id, relationTemplateId: root.relationTemplate.id, governedJourneyId: root.relationTemplate.governedJourney.id, relationCaseId: null as string | null };
}

async function activeRole(database: PrismaClient | Prisma.TransactionClient, scope: Awaited<ReturnType<typeof resolveOwner>>, userId: string, permission: GovernedMemoryPermission) {
  const roles = await database.governedJourneyMemoryRoleAssignment.findMany({ where: { userId, governedJourneyId: scope.governedJourneyId, relationTemplateId: scope.relationTemplateId, revokedAt: null, role: { in: allowedRoles } }, select: { role: true } });
  return roles.find(({ role }) => ROLE_PERMISSIONS[role].includes(permission))?.role ?? null;
}

async function resolveObject(database: PrismaClient | Prisma.TransactionClient, scope: Awaited<ReturnType<typeof resolveOwner>>, publicMemoryKey: string, type: "FACT" | "DECISION") {
  const key = required(publicMemoryKey, 64); if (!/^[0-9a-f]{64}$/.test(key)) throw new GovernedMemoryTransitionError("INVALID_INPUT");
  const rows = type === "FACT"
    ? await database.governedMemoryFact.findMany({ where: { governedJourneyId: scope.governedJourneyId, relationTemplateId: scope.relationTemplateId }, select: { id: true, relationCaseId: true, status: true, updatedAt: true, statement: true } })
    : await database.governedMemoryDecision.findMany({ where: { governedJourneyId: scope.governedJourneyId, relationTemplateId: scope.relationTemplateId }, select: { id: true, relationCaseId: true, status: true, updatedAt: true, title: true } });
  const object = rows.find(({ id }) => buildCockpitPublicMemoryKey(type, id) === key);
  if (!object) throw new GovernedMemoryTransitionError("NOT_FOUND");
  return object;
}

async function recovered(database: PrismaClient, requesterUserId: string, requestKey: string, fingerprint: string, transition: GovernedMemoryTransitionType) {
  const row = await database.governedMemoryTransitionRequest.findUnique({ where: { requesterUserId_requestKey: { requesterUserId, requestKey } }, select: { requestFingerprint: true, transitionType: true, completedAt: true } });
  if (!row) return null;
  if (!fingerprintsEqual(row.requestFingerprint, fingerprint) || row.transitionType !== transition) throw new GovernedMemoryTransitionError("TRANSITION_CONFLICT");
  if (!row.completedAt) return null;
  return { transition, applied: false, finalStateLabel: transitionFinalStateLabel[transition] };
}

async function execute(input: Common, transition: GovernedMemoryTransitionType, canonicalBusiness: (scope: Awaited<ReturnType<typeof resolveOwner>>) => Record<string, unknown>, shape: (scope: Awaited<ReturnType<typeof resolveOwner>>) => Record<string, unknown>, apply: (tx: Prisma.TransactionClient, scope: Awaited<ReturnType<typeof resolveOwner>>, now: Date) => Promise<{ result: Record<string, string>; applied: boolean }>, database: PrismaClient) {
  const requesterUserId = required(input.requesterUserId, 200), formTemplateId = required(input.formTemplateId, 200); const requestKey = normalizeTransitionRequestKey(input.requestKey); if (!requestKey) throw new GovernedMemoryTransitionError("INVALID_INPUT");
  const normalized = { ...input, requesterUserId, formTemplateId }; const scope = await resolveOwner(database, normalized);
  const fingerprint = buildTransitionFingerprint({ transitionType: transition, requesterUserId, ...scope, ...canonicalBusiness(scope) });
  const prior = await recovered(database, requesterUserId, requestKey, fingerprint, transition); if (prior) return prior;
  for (let attempt = 0; attempt < 2; attempt += 1) try {
    return await database.$transaction(async (tx) => {
      await tx.governedMemoryTransitionRequest.create({ data: { requesterUserId, requestKey, requestFingerprint: fingerprint, transitionType: transition, relationTemplateId: scope.relationTemplateId, governedJourneyId: scope.governedJourneyId, relationCaseId: scope.relationCaseId, ...shape(scope) } });
      const checked = await resolveOwner(tx, normalized); if (checked.relationTemplateId !== scope.relationTemplateId || checked.governedJourneyId !== scope.governedJourneyId) throw new GovernedMemoryTransitionError("TRANSITION_CONFLICT");
      const now = new Date(); const outcome = await apply(tx, checked, now);
      const completed = await tx.governedMemoryTransitionRequest.updateMany({ where: { requesterUserId, requestKey, requestFingerprint: fingerprint, completedAt: null }, data: { ...outcome.result, completedAt: now } });
      if (completed.count !== 1) throw new GovernedMemoryTransitionError("TRANSITION_CONFLICT");
      return { transition, applied: outcome.applied, finalStateLabel: transitionFinalStateLabel[transition] };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof GovernedMemoryTransitionError) throw error;
    if (prismaCode(error, "P2002")) { const value = await recovered(database, requesterUserId, requestKey, fingerprint, transition); if (value) return value; if (attempt === 0) { await retryWait(); continue; } throw new GovernedMemoryTransitionError("TRANSITION_CONFLICT"); }
    if (prismaCode(error, "P2034") && attempt === 0) { await retryWait(); continue; }
    throw new GovernedMemoryTransitionError("GOVERNED_MEMORY_TRANSITION_FAILED");
  }
  throw new GovernedMemoryTransitionError("GOVERNED_MEMORY_TRANSITION_FAILED");
}

export function grantJourneyMemoryRole(input: RoleInput, database: PrismaClient = prisma) {
  const targetUserId = required(input.targetUserId, 200); if (!allowedRoles.includes(input.role)) throw new GovernedMemoryTransitionError("INVALID_INPUT");
  return execute(input, "GRANT_JOURNEY_MEMORY_ROLE", () => ({ targetUserId, role: input.role }), () => ({ targetUserId, role: input.role }), async (tx, scope, now) => {
    if (!await tx.user.findUnique({ where: { id: targetUserId }, select: { id: true } })) throw new GovernedMemoryTransitionError("NOT_FOUND");
    const existing = await tx.governedJourneyMemoryRoleAssignment.findUnique({ where: { userId_governedJourneyId_role: { userId: targetUserId, governedJourneyId: scope.governedJourneyId, role: input.role } }, select: { id: true, revokedAt: true } });
    if (existing && !existing.revokedAt) return { result: { roleAssignmentId: existing.id }, applied: false };
    const assignment = existing ? await tx.governedJourneyMemoryRoleAssignment.update({ where: { id: existing.id }, data: { revokedAt: null, grantedByUserId: input.requesterUserId, createdAt: now }, select: { id: true } }) : await tx.governedJourneyMemoryRoleAssignment.create({ data: { userId: targetUserId, governedJourneyId: scope.governedJourneyId, relationTemplateId: scope.relationTemplateId, role: input.role, grantedByUserId: input.requesterUserId, createdAt: now }, select: { id: true } });
    return { result: { roleAssignmentId: assignment.id }, applied: true };
  }, database);
}

export function revokeJourneyMemoryRole(input: RoleInput, database: PrismaClient = prisma) {
  const targetUserId = required(input.targetUserId, 200); if (!allowedRoles.includes(input.role)) throw new GovernedMemoryTransitionError("INVALID_INPUT");
  return execute(input, "REVOKE_JOURNEY_MEMORY_ROLE", () => ({ targetUserId, role: input.role }), () => ({ targetUserId, role: input.role }), async (tx, scope, now) => {
    const existing = await tx.governedJourneyMemoryRoleAssignment.findUnique({ where: { userId_governedJourneyId_role: { userId: targetUserId, governedJourneyId: scope.governedJourneyId, role: input.role } }, select: { id: true, revokedAt: true } });
    if (!existing) throw new GovernedMemoryTransitionError("NOT_FOUND");
    if (!existing.revokedAt) await tx.governedJourneyMemoryRoleAssignment.update({ where: { id: existing.id }, data: { revokedAt: now } });
    return { result: { roleAssignmentId: existing.id }, applied: !existing.revokedAt };
  }, database);
}

export function establishJourneyFact(input: ObjectInput & { justification: string; concurrencyToken: string }, database: PrismaClient = prisma) {
  const justification = required(input.justification); return resolveOwner(database, input).then(async (scope) => { const fact = await resolveObject(database, scope, input.publicMemoryKey, "FACT");
    if (!verifyMemoryConcurrencyToken(input.concurrencyToken, { id: fact.id, updatedAt: fact.updatedAt, type: "FACT", governedJourneyId: scope.governedJourneyId })) throw new GovernedMemoryTransitionError("STATE_CONFLICT");
    return execute(input, "ESTABLISH_FACT", () => ({ factId: fact.id, justification, expectedUpdatedAt: fact.updatedAt.toISOString() }), () => ({ factId: fact.id }), async (tx, checked, now) => {
      const validatorRole = await activeRole(tx, checked, input.requesterUserId, "ESTABLISH_FACT"); if (!validatorRole) throw new GovernedMemoryTransitionError("FORBIDDEN");
      const validation = await tx.governedMemoryValidation.create({ data: { relationTemplateId: checked.relationTemplateId, governedJourneyId: checked.governedJourneyId, relationCaseId: fact.relationCaseId, targetType: "FACT", targetId: fact.id, validatorUserId: input.requesterUserId, validatorRole, decision: "APPROVED", rationale: justification, validatedAt: now }, select: { id: true } });
      const changed = await tx.governedMemoryFact.updateMany({ where: { id: fact.id, governedJourneyId: checked.governedJourneyId, status: "PROPOSED", updatedAt: fact.updatedAt }, data: { status: "ESTABLISHED", establishedByUserId: input.requesterUserId, establishedAt: now } }); if (changed.count !== 1) throw new GovernedMemoryTransitionError("STATE_CONFLICT");
      const event = await tx.governedMemoryEvent.create({ data: { relationTemplateId: checked.relationTemplateId, governedJourneyId: checked.governedJourneyId, relationCaseId: fact.relationCaseId, type: "FACT_ESTABLISHED", actorType: "HUMAN", actorUserId: input.requesterUserId, objectType: "FACT", objectId: fact.id, occurredAt: now, recordedAt: now, summary: "Fact established after explicit human validation." }, select: { id: true } }); return { result: { validationId: validation.id, eventId: event.id }, applied: true };
    }, database); });
}

export function disputeJourneyFact(input: ObjectInput & { reason: string }, database: PrismaClient = prisma) {
  const reason = required(input.reason); return resolveOwner(database, input).then(async (scope) => { const fact = await resolveObject(database, scope, input.publicMemoryKey, "FACT");
    return execute(input, "DISPUTE_FACT", () => ({ factId: fact.id, reason }), () => ({ factId: fact.id }), async (tx, checked, now) => {
      if (!await activeRole(tx, checked, input.requesterUserId, "DISPUTE_FACT")) throw new GovernedMemoryTransitionError("FORBIDDEN");
      const dispute = await tx.governedMemoryDispute.create({ data: { relationTemplateId: checked.relationTemplateId, governedJourneyId: checked.governedJourneyId, relationCaseId: fact.relationCaseId, targetType: "FACT", targetId: fact.id, raisedByUserId: input.requesterUserId, reason, status: "OPEN", raisedAt: now }, select: { id: true } });
      const event = await tx.governedMemoryEvent.create({ data: { relationTemplateId: checked.relationTemplateId, governedJourneyId: checked.governedJourneyId, relationCaseId: fact.relationCaseId, type: "DISPUTE_OPENED", actorType: "HUMAN", actorUserId: input.requesterUserId, objectType: "FACT", objectId: fact.id, occurredAt: now, recordedAt: now, summary: "Fact dispute opened explicitly by a human actor." }, select: { id: true } }); return { result: { disputeId: dispute.id, eventId: event.id }, applied: true };
    }, database); });
}

export function validateJourneyDecision(input: ObjectInput & { justification: string; concurrencyToken: string }, database: PrismaClient = prisma) {
  const justification = required(input.justification); return resolveOwner(database, input).then(async (scope) => { const decision = await resolveObject(database, scope, input.publicMemoryKey, "DECISION");
    if (!verifyMemoryConcurrencyToken(input.concurrencyToken, { id: decision.id, updatedAt: decision.updatedAt, type: "DECISION", governedJourneyId: scope.governedJourneyId })) throw new GovernedMemoryTransitionError("STATE_CONFLICT");
    return execute(input, "VALIDATE_DECISION", () => ({ decisionId: decision.id, justification, expectedUpdatedAt: decision.updatedAt.toISOString(), validationDecision: "APPROVED" }), () => ({ decisionId: decision.id }), async (tx, checked, now) => {
      const validatorRole = await activeRole(tx, checked, input.requesterUserId, "VALIDATE_DECISION"); if (!validatorRole) throw new GovernedMemoryTransitionError("FORBIDDEN");
      const validation = await tx.governedMemoryValidation.create({ data: { relationTemplateId: checked.relationTemplateId, governedJourneyId: checked.governedJourneyId, relationCaseId: decision.relationCaseId, targetType: "DECISION", targetId: decision.id, validatorUserId: input.requesterUserId, validatorRole, decision: "APPROVED", rationale: justification, validatedAt: now }, select: { id: true } });
      const changed = await tx.governedMemoryDecision.updateMany({ where: { id: decision.id, governedJourneyId: checked.governedJourneyId, status: "DRAFT", updatedAt: decision.updatedAt }, data: { status: "VALIDATED", validatedByUserId: input.requesterUserId, validatedAt: now } }); if (changed.count !== 1) throw new GovernedMemoryTransitionError("STATE_CONFLICT");
      const event = await tx.governedMemoryEvent.create({ data: { relationTemplateId: checked.relationTemplateId, governedJourneyId: checked.governedJourneyId, relationCaseId: decision.relationCaseId, type: "DECISION_VALIDATED", actorType: "HUMAN", actorUserId: input.requesterUserId, objectType: "DECISION", objectId: decision.id, occurredAt: now, recordedAt: now, summary: "Decision approved by explicit human validation." }, select: { id: true } }); return { result: { validationId: validation.id, eventId: event.id }, applied: true };
    }, database); });
}
