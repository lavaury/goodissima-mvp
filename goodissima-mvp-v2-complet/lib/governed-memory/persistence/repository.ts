import type { GovernedMemoryEventType, GovernedMemoryPermission, GovernedMemoryRole, GovernedMemorySourceKind, GovernedMemorySourceStatus, GovernedMemoryTargetType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;
const boundedLimit = (limit: number) => Math.min(Math.max(limit, 1), 100);

const factSelect = { id: true, relationCaseId: true, statement: true, status: true, evidenceLevel: true, authorUserId: true, authorRepresentationId: true, recordedAt: true, effectiveFrom: true, effectiveUntil: true, establishedByUserId: true, establishedAt: true, supersedesFactId: true, supersededByFactId: true, createdAt: true, updatedAt: true } satisfies Prisma.GovernedMemoryFactSelect;
const decisionSelect = { id: true, relationCaseId: true, title: true, rationale: true, status: true, decidedByUserId: true, validatedByUserId: true, decidedAt: true, validatedAt: true, recordedAt: true, effectiveFrom: true, effectiveUntil: true, consequences: true, reservations: true, createdAt: true, updatedAt: true } satisfies Prisma.GovernedMemoryDecisionSelect;
const sourceSelect = { id: true, relationCaseId: true, kind: true, status: true, sourceObjectType: true, sourceObjectId: true, title: true, authoredAt: true, receivedAt: true, recordedAt: true, promotedByUserId: true, promotedAt: true, visibilityPolicyRef: true, retentionPolicyRef: true, integrityRef: true, unavailableReason: true, excerpt: true, promotionPurpose: true, consentBasis: true, externalOrigin: true, createdAt: true, updatedAt: true } satisfies Prisma.GovernedMemorySourceSelect;
const grantSelect = { id: true, relationCaseId: true, subjectType: true, subjectUserId: true, subjectRepresentationId: true, permission: true, resourceType: true, resourceId: true, grantedByUserId: true, basis: true, grantedAt: true, effectiveFrom: true, effectiveUntil: true, revokedAt: true, revokedByUserId: true, residualPermission: true, residualEffectiveUntil: true, residualBasis: true, createdAt: true, updatedAt: true } satisfies Prisma.GovernedMemoryAccessGrantSelect;

async function targetExists(tx: Tx, relationCaseId: string, type: GovernedMemoryTargetType, id: string) {
  if (type === "FACT") return Boolean(await tx.governedMemoryFact.findUnique({ where: { id_relationCaseId: { id, relationCaseId } }, select: { id: true } }));
  if (type === "DECISION") return Boolean(await tx.governedMemoryDecision.findUnique({ where: { id_relationCaseId: { id, relationCaseId } }, select: { id: true } }));
  return Boolean(await tx.governedMemorySource.findUnique({ where: { id_relationCaseId: { id, relationCaseId } }, select: { id: true } }));
}

async function appendHumanEvent(tx: Tx, input: { relationCaseId: string; type: GovernedMemoryEventType; actorUserId: string; actorRepresentationId?: string | null; objectType: GovernedMemoryTargetType; objectId: string; occurredAt: Date; recordedAt: Date; summary: string }) {
  return tx.governedMemoryEvent.create({ data: { ...input, actorType: "HUMAN" }, select: { id: true } });
}

export type GovernedMemoryRepository = ReturnType<typeof createGovernedMemoryRepository>;
export function createGovernedMemoryRepository(database: Db = prisma) {
  return {
    findCaseForOwner(ownerId: string, relationCaseId: string) {
      return database.relationCase.findFirst({ where: { id: relationCaseId, ownerId }, select: { id: true, ownerId: true, governanceStatus: true } });
    },
    findCase(relationCaseId: string) {
      return database.relationCase.findUnique({ where: { id: relationCaseId }, select: { id: true, ownerId: true, governanceStatus: true } });
    },
    findActiveRoles(relationCaseId: string, userId: string, at: Date) {
      return database.governedMemoryRoleAssignment.findMany({ where: { relationCaseId, userId, assignedAt: { lte: at }, OR: [{ revokedAt: null }, { revokedAt: { gt: at } }] }, select: { role: true }, orderBy: [{ role: "asc" }, { assignedAt: "asc" }] });
    },
    findEffectiveGrants(relationCaseId: string, userId: string, representationIds: readonly string[], at: Date) {
      return database.governedMemoryAccessGrant.findMany({
        where: {
          relationCaseId,
          effectiveFrom: { lte: at },
          AND: [
            { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }] },
            { OR: [{ revokedAt: null }, { revokedAt: { gt: at } }] },
            { OR: [{ subjectType: "USER", subjectUserId: userId }, { subjectType: "REPRESENTATION", subjectRepresentationId: { in: [...representationIds] } }] },
          ],
        },
        select: grantSelect,
        orderBy: [{ permission: "asc" }, { effectiveFrom: "asc" }, { id: "asc" }],
      });
    },
    findOwnedRepresentationIds(userId: string) {
      return database.representation.findMany({ where: { ownerId: userId }, select: { id: true }, orderBy: { id: "asc" } }).then((rows) => rows.map(({ id }) => id));
    },

    createProposedFact(input: { relationCaseId: string; statement: string; evidenceLevel: Prisma.GovernedMemoryFactCreateInput["evidenceLevel"]; authorUserId: string; authorRepresentationId?: string | null; recordedAt: Date; effectiveFrom: Date; effectiveUntil?: Date | null }) {
      return database.$transaction(async (tx) => {
        const fact = await tx.governedMemoryFact.create({ data: { ...input, status: "PROPOSED" }, select: factSelect });
        await appendHumanEvent(tx, { relationCaseId: input.relationCaseId, type: "FACT_PROPOSED", actorUserId: input.authorUserId, actorRepresentationId: input.authorRepresentationId, objectType: "FACT", objectId: fact.id, occurredAt: input.effectiveFrom, recordedAt: input.recordedAt, summary: "Fact proposed by a human actor." });
        return fact;
      });
    },
    findFactByIdInCase(relationCaseId: string, id: string) { return database.governedMemoryFact.findUnique({ where: { id_relationCaseId: { id, relationCaseId } }, select: factSelect }); },
    establishFactConditionally(input: { relationCaseId: string; id: string; expectedUpdatedAt: Date; validatorUserId: string; validatorRole: GovernedMemoryRole; rationale: string; now: Date }) {
      return database.$transaction(async (tx) => {
        const changed = await tx.governedMemoryFact.updateMany({ where: { id: input.id, relationCaseId: input.relationCaseId, status: "PROPOSED", updatedAt: input.expectedUpdatedAt }, data: { status: "ESTABLISHED", establishedByUserId: input.validatorUserId, establishedAt: input.now } });
        if (changed.count !== 1) return null;
        await tx.governedMemoryValidation.create({ data: { relationCaseId: input.relationCaseId, targetType: "FACT", targetId: input.id, validatorUserId: input.validatorUserId, validatorRole: input.validatorRole, decision: "APPROVED", rationale: input.rationale, validatedAt: input.now } });
        await appendHumanEvent(tx, { relationCaseId: input.relationCaseId, type: "FACT_ESTABLISHED", actorUserId: input.validatorUserId, objectType: "FACT", objectId: input.id, occurredAt: input.now, recordedAt: input.now, summary: "Fact established after human validation." });
        return tx.governedMemoryFact.findUnique({ where: { id_relationCaseId: { id: input.id, relationCaseId: input.relationCaseId } }, select: factSelect });
      });
    },
    supersedeFactTransactionally(input: { relationCaseId: string; priorFactId: string; expectedUpdatedAt: Date; statement: string; evidenceLevel: Prisma.GovernedMemoryFactCreateInput["evidenceLevel"]; actorUserId: string; effectiveFrom: Date; now: Date }) {
      return database.$transaction(async (tx) => {
        const prior = await tx.governedMemoryFact.findUnique({ where: { id_relationCaseId: { id: input.priorFactId, relationCaseId: input.relationCaseId } }, select: { id: true, status: true, updatedAt: true, authorRepresentationId: true } });
        if (!prior || prior.status === "SUPERSEDED" || prior.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) return null;
        const successor = await tx.governedMemoryFact.create({ data: { relationCaseId: input.relationCaseId, statement: input.statement, status: "PROPOSED", evidenceLevel: input.evidenceLevel, authorUserId: input.actorUserId, recordedAt: input.now, effectiveFrom: input.effectiveFrom, supersedesFactId: prior.id }, select: factSelect });
        const changed = await tx.governedMemoryFact.updateMany({ where: { id: prior.id, relationCaseId: input.relationCaseId, updatedAt: input.expectedUpdatedAt, status: { not: "SUPERSEDED" } }, data: { status: "SUPERSEDED", supersededByFactId: successor.id, effectiveUntil: input.effectiveFrom } });
        if (changed.count !== 1) throw new Error("GOVERNED_MEMORY_CONCURRENT_FACT_SUPERSESSION");
        await tx.governedMemoryRelation.create({ data: { relationCaseId: input.relationCaseId, type: "REPLACES", sourceType: "FACT", sourceId: successor.id, targetType: "FACT", targetId: prior.id, createdByUserId: input.actorUserId } });
        await appendHumanEvent(tx, { relationCaseId: input.relationCaseId, type: "FACT_SUPERSEDED", actorUserId: input.actorUserId, objectType: "FACT", objectId: prior.id, occurredAt: input.effectiveFrom, recordedAt: input.now, summary: "Fact superseded by a new historical version." });
        return successor;
      });
    },
    listFactsKnownAt(relationCaseId: string, at: Date, limit = 100) { return database.governedMemoryFact.findMany({ where: { relationCaseId, recordedAt: { lte: at } }, select: factSelect, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], take: boundedLimit(limit) }); },
    listFactsAtDate(relationCaseId: string, at: Date, limit = 100) { return database.governedMemoryFact.findMany({ where: { relationCaseId, recordedAt: { lte: at }, effectiveFrom: { lte: at }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }] }, select: factSelect, orderBy: [{ effectiveFrom: "asc" }, { recordedAt: "asc" }, { id: "asc" }], take: boundedLimit(limit) }); },

    createDraftDecision(input: { relationCaseId: string; title: string; rationale: string; decidedByUserId: string; decidedAt: Date; recordedAt: Date; effectiveFrom: Date; effectiveUntil?: Date | null; consequences?: string | null; reservations?: string | null }) {
      return database.$transaction(async (tx) => { const decision = await tx.governedMemoryDecision.create({ data: { ...input, status: "DRAFT" }, select: decisionSelect }); await appendHumanEvent(tx, { relationCaseId: input.relationCaseId, type: "DECISION_RECORDED", actorUserId: input.decidedByUserId, objectType: "DECISION", objectId: decision.id, occurredAt: input.decidedAt, recordedAt: input.recordedAt, summary: "Decision draft recorded by a human actor." }); return decision; });
    },
    updateDraftDecisionConditionally(relationCaseId: string, id: string, expectedUpdatedAt: Date, data: { title?: string; rationale?: string; effectiveFrom?: Date; effectiveUntil?: Date | null; consequences?: string | null; reservations?: string | null }) { return database.governedMemoryDecision.updateMany({ where: { id, relationCaseId, status: "DRAFT", updatedAt: expectedUpdatedAt }, data }); },
    validateDecisionConditionally(input: { relationCaseId: string; id: string; expectedUpdatedAt: Date; validatorUserId: string; validatorRole: GovernedMemoryRole; rationale: string; now: Date }) {
      return database.$transaction(async (tx) => { const changed = await tx.governedMemoryDecision.updateMany({ where: { id: input.id, relationCaseId: input.relationCaseId, status: "DRAFT", updatedAt: input.expectedUpdatedAt }, data: { status: "VALIDATED", rationale: input.rationale, validatedByUserId: input.validatorUserId, validatedAt: input.now } }); if (changed.count !== 1) return null; await tx.governedMemoryValidation.create({ data: { relationCaseId: input.relationCaseId, targetType: "DECISION", targetId: input.id, validatorUserId: input.validatorUserId, validatorRole: input.validatorRole, decision: "APPROVED", rationale: input.rationale, validatedAt: input.now } }); await appendHumanEvent(tx, { relationCaseId: input.relationCaseId, type: "DECISION_VALIDATED", actorUserId: input.validatorUserId, objectType: "DECISION", objectId: input.id, occurredAt: input.now, recordedAt: input.now, summary: "Decision validated by an authorized human." }); return tx.governedMemoryDecision.findUnique({ where: { id_relationCaseId: { id: input.id, relationCaseId: input.relationCaseId } }, select: decisionSelect }); });
    },
    createSuccessorDecision(input: { relationCaseId: string; priorDecisionId: string; type: "REPLACES" | "CORRECTS" | "CANCELS" | "COMPLEMENTS"; title: string; rationale: string; actorUserId: string; effectiveFrom: Date; now: Date }) {
      return database.$transaction(async (tx) => { const prior = await tx.governedMemoryDecision.findUnique({ where: { id_relationCaseId: { id: input.priorDecisionId, relationCaseId: input.relationCaseId } }, select: { id: true, status: true } }); if (!prior || prior.status === "DRAFT") return null; const successor = await tx.governedMemoryDecision.create({ data: { relationCaseId: input.relationCaseId, title: input.title, rationale: input.rationale, status: "DRAFT", decidedByUserId: input.actorUserId, decidedAt: input.now, recordedAt: input.now, effectiveFrom: input.effectiveFrom }, select: decisionSelect }); await tx.governedMemoryRelation.create({ data: { relationCaseId: input.relationCaseId, type: input.type, sourceType: "DECISION", sourceId: successor.id, targetType: "DECISION", targetId: prior.id, createdByUserId: input.actorUserId } }); return successor; });
    },
    findDecisionByIdInCase(relationCaseId: string, id: string) { return database.governedMemoryDecision.findUnique({ where: { id_relationCaseId: { id, relationCaseId } }, select: decisionSelect }); },
    listDecisionsAtDate(relationCaseId: string, at: Date, limit = 100) { return database.governedMemoryDecision.findMany({ where: { relationCaseId, recordedAt: { lte: at }, effectiveFrom: { lte: at }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }] }, select: decisionSelect, orderBy: [{ effectiveFrom: "asc" }, { recordedAt: "asc" }, { id: "asc" }], take: boundedLimit(limit) }); },

    registerSource(input: Prisma.GovernedMemorySourceUncheckedCreateInput, actorUserId: string, now: Date) {
      return database.$transaction(async (tx) => { const source = await tx.governedMemorySource.create({ data: input, select: sourceSelect }); await appendHumanEvent(tx, { relationCaseId: source.relationCaseId, type: source.kind === "MESSAGE_EXCERPT" ? "SOURCE_PROMOTED" : "SOURCE_REGISTERED", actorUserId, objectType: "SOURCE", objectId: source.id, occurredAt: source.promotedAt ?? source.recordedAt, recordedAt: now, summary: source.kind === "MESSAGE_EXCERPT" ? "Private message excerpt promoted explicitly." : "Memory source registered explicitly." }); return source; });
    },
    findSourceObjectInCase(relationCaseId: string, type: string, id: string) {
      if (type === "Document") return database.document.findFirst({ where: { id, caseId: relationCaseId }, select: { id: true, caseId: true } });
      if (type === "Message") return database.message.findFirst({ where: { id, caseId: relationCaseId }, select: { id: true, caseId: true } });
      if (type === "FormSubmission") return database.formSubmission.findFirst({ where: { id, caseId: relationCaseId }, select: { id: true, caseId: true } });
      if (type === "RelationEvent") return database.relationEvent.findFirst({ where: { id, caseId: relationCaseId }, select: { id: true, caseId: true } });
      return Promise.resolve(null);
    },
    findSourceForCase(relationCaseId: string, id: string) { return database.governedMemorySource.findUnique({ where: { id_relationCaseId: { id, relationCaseId } }, select: sourceSelect }); },
    updateSourceLifecycleConditionally(relationCaseId: string, id: string, expectedUpdatedAt: Date, status: GovernedMemorySourceStatus, unavailableReason: string | null, actorUserId: string, now: Date) {
      return database.$transaction(async (tx) => { const changed = await tx.governedMemorySource.updateMany({ where: { id, relationCaseId, updatedAt: expectedUpdatedAt }, data: { status, unavailableReason } }); if (changed.count !== 1) return false; if (["RESTRICTED", "DELETED"].includes(status)) await appendHumanEvent(tx, { relationCaseId, type: status === "DELETED" ? "SOURCE_DELETED" : "SOURCE_RESTRICTED", actorUserId, objectType: "SOURCE", objectId: id, occurredAt: now, recordedAt: now, summary: `Source lifecycle changed to ${status}.` }); return true; });
    },

    grantPermission(input: Prisma.GovernedMemoryAccessGrantUncheckedCreateInput, actorUserId: string, now: Date) { return database.$transaction(async (tx) => { const grant = await tx.governedMemoryAccessGrant.create({ data: input, select: grantSelect }); await appendHumanEvent(tx, { relationCaseId: grant.relationCaseId, type: "ACCESS_GRANTED", actorUserId, objectType: grant.resourceType ?? "SOURCE", objectId: grant.resourceId ?? grant.id, occurredAt: grant.effectiveFrom, recordedAt: now, summary: "Explicit memory permission granted." }); return grant; }); },
    revokePermissionConditionally(relationCaseId: string, id: string, expectedUpdatedAt: Date, actorUserId: string, now: Date) { return database.$transaction(async (tx) => { const changed = await tx.governedMemoryAccessGrant.updateMany({ where: { id, relationCaseId, revokedAt: null, updatedAt: expectedUpdatedAt }, data: { revokedAt: now, revokedByUserId: actorUserId } }); if (changed.count !== 1) return false; await appendHumanEvent(tx, { relationCaseId, type: "ACCESS_REVOKED", actorUserId, objectType: "SOURCE", objectId: id, occurredAt: now, recordedAt: now, summary: "Memory permission revoked explicitly." }); return true; }); },
    listEffectiveGrantsAt(relationCaseId: string, at: Date, limit = 100) { return database.governedMemoryAccessGrant.findMany({ where: { relationCaseId, effectiveFrom: { lte: at }, AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }] }, { OR: [{ revokedAt: null }, { revokedAt: { gt: at } }] }] }, select: grantSelect, orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }], take: boundedLimit(limit) }); },

    appendValidation(input: Prisma.GovernedMemoryValidationUncheckedCreateInput) { return database.$transaction(async (tx) => { if (!await targetExists(tx, input.relationCaseId, input.targetType, input.targetId)) return null; const validation = await tx.governedMemoryValidation.create({ data: input }); await appendHumanEvent(tx, { relationCaseId: input.relationCaseId, type: "VALIDATION_RECORDED", actorUserId: input.validatorUserId, objectType: input.targetType, objectId: input.targetId, occurredAt: new Date(input.validatedAt), recordedAt: validation.createdAt, summary: "Append-only human validation recorded." }); return validation; }); },
    openDispute(input: Prisma.GovernedMemoryDisputeUncheckedCreateInput) { return database.$transaction(async (tx) => { if (!await targetExists(tx, input.relationCaseId, input.targetType, input.targetId)) return null; const dispute = await tx.governedMemoryDispute.create({ data: input }); await appendHumanEvent(tx, { relationCaseId: input.relationCaseId, type: "DISPUTE_OPENED", actorUserId: input.raisedByUserId, objectType: input.targetType, objectId: input.targetId, occurredAt: new Date(input.raisedAt), recordedAt: dispute.createdAt, summary: "Memory object disputed without deleting its history." }); return dispute; }); },
    resolveDisputeConditionally(input: { relationCaseId: string; id: string; expectedUpdatedAt: Date; status: "RESOLVED" | "MAINTAINED" | "WITHDRAWN"; actorUserId: string; authorityMayWithdraw: boolean; resolution: string; now: Date }) { return database.$transaction(async (tx) => { const current = await tx.governedMemoryDispute.findUnique({ where: { id_relationCaseId: { id: input.id, relationCaseId: input.relationCaseId } }, select: { raisedByUserId: true, targetType: true, targetId: true } }); if (!current || (input.status === "WITHDRAWN" && current.raisedByUserId !== input.actorUserId && !input.authorityMayWithdraw)) return false; const changed = await tx.governedMemoryDispute.updateMany({ where: { id: input.id, relationCaseId: input.relationCaseId, status: "OPEN", updatedAt: input.expectedUpdatedAt }, data: { status: input.status, resolvedAt: input.now, resolvedByUserId: input.actorUserId, resolution: input.resolution } }); if (changed.count !== 1) return false; await appendHumanEvent(tx, { relationCaseId: input.relationCaseId, type: "DISPUTE_RESOLVED", actorUserId: input.actorUserId, objectType: current.targetType, objectId: current.targetId, occurredAt: input.now, recordedAt: input.now, summary: `Dispute closed as ${input.status}.` }); return true; }); },
    appendEvent(input: Prisma.GovernedMemoryEventUncheckedCreateInput) { return database.$transaction(async (tx) => { if (!await targetExists(tx, input.relationCaseId, input.objectType, input.objectId)) return null; return tx.governedMemoryEvent.create({ data: input }); }); },
    listEventsAtDate(relationCaseId: string, at: Date, limit = 100) { return database.governedMemoryEvent.findMany({ where: { relationCaseId, recordedAt: { lte: at } }, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], take: boundedLimit(limit) }); },

    assignMemoryRole(input: { relationCaseId: string; userId: string; role: GovernedMemoryRole; assignedByUserId: string; assignedAt: Date }) { return database.governedMemoryRoleAssignment.create({ data: input }); },
    revokeMemoryRole(relationCaseId: string, id: string, actorUserId: string, now: Date) { return database.governedMemoryRoleAssignment.updateMany({ where: { id, relationCaseId, revokedAt: null }, data: { revokedAt: now, revokedByUserId: actorUserId } }); },
  };
}

export const governedMemoryRepository = createGovernedMemoryRepository();
