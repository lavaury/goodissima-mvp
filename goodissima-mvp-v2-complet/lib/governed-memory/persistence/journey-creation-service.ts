import type { GovernedMemoryCreationCategory, GovernedMemoryEvidenceLevel, GovernedMemoryPermission, GovernedMemorySourceKind, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLE_PERMISSIONS } from "@/lib/governed-memory/permissions";
import { buildMemoryCreationFingerprint, buildPublicMemoryKey, memoryFingerprintsEqual, normalizeMemoryCreationRequestKey, type MemoryCreationCanonicalPayload } from "./creation-idempotency";
import { completeMemoryCreation, createMemoryCreationReservation, findCompletedMemoryCreationRequest, isMemoryRequestKeyConflict, isMemoryResultConflict, isMemorySerializationConflict, type CompletedMemoryCreationRequest } from "./creation-request-repository";

type Database = PrismaClient | Prisma.TransactionClient;
type Category = GovernedMemoryCreationCategory;
export type GovernedMemoryCreationResult = { category: "FACT" | "DECISION" | "SOURCE"; created: boolean; publicMemoryKey: string };
export type GovernedMemoryCreationErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "CREATION_CONFLICT" | "GOVERNED_MEMORY_CREATION_FAILED";
export class GovernedMemoryCreationError extends Error { constructor(readonly code: GovernedMemoryCreationErrorCode) { super(code); this.name = "GovernedMemoryCreationError"; } }

type CommonInput = { requesterUserId: string; formTemplateId: string; requestKey: string; relationCaseId?: string | null; provenance?: string | null };
export type ProposeJourneyFactInput = CommonInput & { statement: string; evidenceLevel: GovernedMemoryEvidenceLevel; effectiveFrom: Date; effectiveUntil?: Date | null };
export type CreateJourneyDecisionDraftInput = CommonInput & { title: string; rationale: string; decidedAt: Date; effectiveFrom: Date; effectiveUntil?: Date | null; consequences?: string | null; reservations?: string | null };
export type RegisterJourneySourceInput = CommonInput & { kind: Exclude<GovernedMemorySourceKind, "MESSAGE_EXCERPT" | "VALIDATED_SYNTHESIS">; title: string; sourceObjectId: string; authoredAt?: Date | null; receivedAt?: Date | null; visibilityPolicyRef?: string | null; externalOrigin?: string | null };

const required = (value: unknown, max: number) => { if (typeof value !== "string") throw new GovernedMemoryCreationError("INVALID_INPUT"); const normalized = value.trim(); if (!normalized || normalized.length > max || /<\/?[a-z][^>]*>/i.test(normalized)) throw new GovernedMemoryCreationError("INVALID_INPUT"); return normalized; };
const optional = (value: string | null | undefined, max: number) => value == null || value.trim() === "" ? null : required(value, max);
const instant = (value: Date | null | undefined) => { if (value == null) return null; if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new GovernedMemoryCreationError("INVALID_INPUT"); return value.toISOString(); };
const interval = (from: Date, until?: Date | null) => { const a = instant(from)!; const b = instant(until); if (b && b <= a) throw new GovernedMemoryCreationError("INVALID_INPUT"); return { from: a, until: b }; };

async function resolveAuthority(database: Database, input: CommonInput, permission: GovernedMemoryPermission) {
  const root = await database.formTemplate.findFirst({ where: { id: input.formTemplateId,
    relationTemplate: { workspace: { ownerId: input.requesterUserId, status: "ACTIVE" } } },
    select: { id: true, relationTemplate: { select: { id: true, workspace: { select: { id: true, ownerId: true, status: true } }, governedJourney: { select: { id: true } } } } } });
  const relationTemplate = root?.relationTemplate; const journey = relationTemplate?.governedJourney;
  if (!root || !relationTemplate?.workspace || !journey) throw new GovernedMemoryCreationError("NOT_FOUND");
  const relationCaseId = input.relationCaseId?.trim() || null;
  const permissions = new Set<GovernedMemoryPermission>(ROLE_PERMISSIONS.RELATION_CASE_OWNER);
  if (relationCaseId) {
    const context = await database.governedJourneyRelationCase.findUnique({ where: { governedJourneyId_relationCaseId: { governedJourneyId: journey.id, relationCaseId } },
      select: { relationTemplateId: true, relationCase: { select: { id: true, templateId: true, ownerId: true, governanceStatus: true } } } });
    if (!context || context.relationTemplateId !== relationTemplate.id || context.relationCase.templateId !== relationTemplate.id || context.relationCase.governanceStatus === "BLOCKED") throw new GovernedMemoryCreationError("NOT_FOUND");
    permissions.clear();
    if (context.relationCase.ownerId === input.requesterUserId) for (const value of ROLE_PERMISSIONS.RELATION_CASE_OWNER) permissions.add(value);
    const representationIds = await database.representation.findMany({ where: { ownerId: input.requesterUserId }, select: { id: true } }).then((rows) => rows.map(({ id }) => id));
    const now = new Date();
    const [roles, grants] = await Promise.all([
      database.governedMemoryRoleAssignment.findMany({ where: { relationCaseId, userId: input.requesterUserId, assignedAt: { lte: now }, OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] }, select: { role: true } }),
      database.governedMemoryAccessGrant.findMany({ where: { relationCaseId, effectiveFrom: { lte: now }, AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }, { OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] }, { OR: [{ subjectType: "USER", subjectUserId: input.requesterUserId }, { subjectType: "REPRESENTATION", subjectRepresentationId: { in: representationIds } }] }] }, select: { permission: true, resourceType: true, resourceId: true } }),
    ]);
    for (const row of roles) for (const value of ROLE_PERMISSIONS[row.role]) permissions.add(value);
    for (const grant of grants) if (!grant.resourceType && !grant.resourceId) permissions.add(grant.permission);
  }
  if (!permissions.has(permission)) throw new GovernedMemoryCreationError("FORBIDDEN");
  return { formTemplateId: root.id, relationTemplateId: relationTemplate.id, governedJourneyId: journey.id, relationCaseId };
}

function resultId(request: CompletedMemoryCreationRequest) { return request.category === "FACT" ? request.factId : request.category === "DECISION" ? request.decisionId : request.sourceId; }
function evaluate(request: CompletedMemoryCreationRequest | null, expected: { requesterUserId: string; requestKey: string; fingerprint: string; category: Category; relationTemplateId: string; governedJourneyId: string; relationCaseId: string | null }): GovernedMemoryCreationResult | null {
  if (!request) return null;
  if (request.requesterUserId !== expected.requesterUserId || request.requestKey !== expected.requestKey) return null;
  if (!memoryFingerprintsEqual(request.requestFingerprint, expected.fingerprint) || request.category !== expected.category || request.relationTemplateId !== expected.relationTemplateId || request.governedJourneyId !== expected.governedJourneyId || request.relationCaseId !== expected.relationCaseId) throw new GovernedMemoryCreationError("CREATION_CONFLICT");
  const id = resultId(request); const object = request.category === "FACT" ? request.fact : request.category === "DECISION" ? request.decision : request.source;
  if (!request.completedAt || !id || !object || object.id !== id || object.relationTemplateId !== expected.relationTemplateId || object.governedJourneyId !== expected.governedJourneyId || object.relationCaseId !== expected.relationCaseId || request.governedJourney.id !== expected.governedJourneyId || request.governedJourney.relationTemplateId !== expected.relationTemplateId || (expected.relationCaseId && (!request.relationCase || request.relationCase.id !== expected.relationCaseId || request.relationCase.templateId !== expected.relationTemplateId))) throw new GovernedMemoryCreationError("GOVERNED_MEMORY_CREATION_FAILED");
  return { category: request.category, created: false, publicMemoryKey: buildPublicMemoryKey(request.category, id) };
}

const waitForRetry = () => new Promise<void>((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 31)));

async function execute(input: CommonInput, category: Category, permission: GovernedMemoryPermission, business: (scope: Awaited<ReturnType<typeof resolveAuthority>>) => MemoryCreationCanonicalPayload["business"], create: (tx: Prisma.TransactionClient, scope: Awaited<ReturnType<typeof resolveAuthority>>, now: Date) => Promise<string>, database: PrismaClient) {
  const requesterUserId = required(input.requesterUserId, 200); const formTemplateId = required(input.formTemplateId, 200);
  const requestKey = normalizeMemoryCreationRequestKey(input.requestKey); if (!requestKey) throw new GovernedMemoryCreationError("INVALID_INPUT");
  const normalizedInput = { ...input, requesterUserId, formTemplateId };
  const scope = await resolveAuthority(database, normalizedInput, permission);
  const fingerprint = buildMemoryCreationFingerprint({ category, requesterUserId, ...scope, business: business(scope) });
  const expected = { requesterUserId, requestKey, fingerprint, category, ...scope };
  const recovered = evaluate(await findCompletedMemoryCreationRequest(database, { requesterUserId, requestKey }), expected); if (recovered) return recovered;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await database.$transaction(async (tx) => {
        await createMemoryCreationReservation({ tx, requesterUserId, requestKey, requestFingerprint: fingerprint, category, relationTemplateId: scope.relationTemplateId, governedJourneyId: scope.governedJourneyId, relationCaseId: scope.relationCaseId });
        const checked = await resolveAuthority(tx, normalizedInput, permission);
        if (checked.relationTemplateId !== scope.relationTemplateId || checked.governedJourneyId !== scope.governedJourneyId || checked.relationCaseId !== scope.relationCaseId) throw new GovernedMemoryCreationError("CREATION_CONFLICT");
        const now = new Date(); const id = await create(tx, checked, now);
        const completed = await completeMemoryCreation({ tx, requesterUserId, requestKey, requestFingerprint: fingerprint, category, relationTemplateId: checked.relationTemplateId, governedJourneyId: checked.governedJourneyId, relationCaseId: checked.relationCaseId, result: category === "FACT" ? { factId: id } : category === "DECISION" ? { decisionId: id } : { sourceId: id }, completedAt: now });
        if (completed.count !== 1) throw new GovernedMemoryCreationError("CREATION_CONFLICT");
        return { category, created: true, publicMemoryKey: buildPublicMemoryKey(category, id) };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof GovernedMemoryCreationError) throw error;
      if (isMemoryRequestKeyConflict(error)) { const value = evaluate(await findCompletedMemoryCreationRequest(database, { requesterUserId, requestKey }), expected); if (value) return value; throw new GovernedMemoryCreationError("CREATION_CONFLICT"); }
      if (isMemoryResultConflict(error)) throw new GovernedMemoryCreationError("CREATION_CONFLICT");
      if (isMemorySerializationConflict(error)) { if (attempt === 0) { await waitForRetry(); continue; } const value = evaluate(await findCompletedMemoryCreationRequest(database, { requesterUserId, requestKey }), expected); if (value) return value; }
      throw new GovernedMemoryCreationError("GOVERNED_MEMORY_CREATION_FAILED");
    }
  }
  throw new GovernedMemoryCreationError("GOVERNED_MEMORY_CREATION_FAILED");
}

export function proposeJourneyFact(input: ProposeJourneyFactInput, database: PrismaClient = prisma) {
  const statement = required(input.statement, 4_000); const dates = interval(input.effectiveFrom, input.effectiveUntil); const provenance = optional(input.provenance, 500);
  if (!["DECLARED", "SUPPORTED", "CORROBORATED", "CONTESTED"].includes(input.evidenceLevel)) throw new GovernedMemoryCreationError("INVALID_INPUT");
  return execute(input, "FACT", "PROPOSE_FACT", () => ({ statement, evidenceLevel: input.evidenceLevel, effectiveFrom: dates.from, effectiveUntil: dates.until, provenance }), async (tx, scope, now) => {
    const memoryScope = { relationTemplateId: scope.relationTemplateId, governedJourneyId: scope.governedJourneyId, relationCaseId: scope.relationCaseId };
    const fact = await tx.governedMemoryFact.create({ data: { ...memoryScope, statement, evidenceLevel: input.evidenceLevel, status: "PROPOSED", authorUserId: input.requesterUserId, recordedAt: now, effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil ?? null }, select: { id: true } });
    await tx.governedMemoryEvent.create({ data: { ...memoryScope, type: "FACT_PROPOSED", actorType: "HUMAN", actorUserId: input.requesterUserId, objectType: "FACT", objectId: fact.id, occurredAt: input.effectiveFrom, recordedAt: now, summary: "Fact proposed by a human actor." } }); return fact.id;
  }, database);
}

export function createJourneyDecisionDraft(input: CreateJourneyDecisionDraftInput, database: PrismaClient = prisma) {
  const title = required(input.title, 300); const rationale = required(input.rationale, 4_000); const dates = interval(input.effectiveFrom, input.effectiveUntil); const decidedAt = instant(input.decidedAt)!; const consequences = optional(input.consequences, 4_000); const reservations = optional(input.reservations, 4_000); const provenance = optional(input.provenance, 500);
  return execute(input, "DECISION", "RECORD_DECISION", () => ({ title, rationale, decidedAt, effectiveFrom: dates.from, effectiveUntil: dates.until, consequences, reservations, provenance }), async (tx, scope, now) => {
    const memoryScope = { relationTemplateId: scope.relationTemplateId, governedJourneyId: scope.governedJourneyId, relationCaseId: scope.relationCaseId };
    const decision = await tx.governedMemoryDecision.create({ data: { ...memoryScope, title, rationale, status: "DRAFT", decidedByUserId: input.requesterUserId, decidedAt: input.decidedAt, recordedAt: now, effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil ?? null, consequences, reservations }, select: { id: true } });
    await tx.governedMemoryEvent.create({ data: { ...memoryScope, type: "DECISION_RECORDED", actorType: "HUMAN", actorUserId: input.requesterUserId, objectType: "DECISION", objectId: decision.id, occurredAt: input.decidedAt, recordedAt: now, summary: "Decision draft recorded by a human actor." } }); return decision.id;
  }, database);
}

export function registerJourneySource(input: RegisterJourneySourceInput, database: PrismaClient = prisma) {
  const title = required(input.title, 300); const sourceObjectId = required(input.sourceObjectId, 2_000); const authoredAt = instant(input.authoredAt); const receivedAt = instant(input.receivedAt); const visibilityPolicyRef = optional(input.visibilityPolicyRef, 1_000); const provenance = optional(input.provenance, 500); const externalOrigin = optional(input.externalOrigin, 2_000);
  const allowed = ["DOCUMENT", "DOCUMENT_VERSION", "FORM_SUBMISSION", "SYSTEM_EVENT", "HUMAN_DECLARATION", "EXTERNAL_IMPORT"] as const; if (!allowed.includes(input.kind as typeof allowed[number])) throw new GovernedMemoryCreationError("INVALID_INPUT");
  if (input.kind === "EXTERNAL_IMPORT") { if (!externalOrigin) throw new GovernedMemoryCreationError("INVALID_INPUT"); try { const url = new URL(externalOrigin); if (!['http:', 'https:'].includes(url.protocol)) throw new Error("protocol"); } catch { throw new GovernedMemoryCreationError("INVALID_INPUT"); } }
  return execute(input, "SOURCE", "REGISTER_SOURCE", () => ({ kind: input.kind, title, sourceObjectId, authoredAt, receivedAt, visibilityPolicyRef, externalOrigin, provenance }), async (tx, scope, now) => {
    const memoryScope = { relationTemplateId: scope.relationTemplateId, governedJourneyId: scope.governedJourneyId, relationCaseId: scope.relationCaseId };
    const source = await tx.governedMemorySource.create({ data: { ...memoryScope, kind: input.kind, status: "ACTIVE", sourceObjectType: input.kind, sourceObjectId, title, authoredAt: input.authoredAt ?? null, receivedAt: input.receivedAt ?? null, recordedAt: now, visibilityPolicyRef, externalOrigin }, select: { id: true } });
    await tx.governedMemoryEvent.create({ data: { ...memoryScope, type: "SOURCE_REGISTERED", actorType: "HUMAN", actorUserId: input.requesterUserId, objectType: "SOURCE", objectId: source.id, occurredAt: now, recordedAt: now, summary: "Memory source registered explicitly." } }); return source.id;
  }, database);
}
