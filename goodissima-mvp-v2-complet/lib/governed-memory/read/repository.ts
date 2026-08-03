import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLE_PERMISSIONS } from "@/lib/governed-memory/permissions";
import type { ResolvedMemoryPermissions } from "@/lib/governed-memory/persistence/permission-resolver";
import type { ReadCursor, TimelineCursor } from "./types";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;
const factSelect = { id: true, statement: true, status: true, evidenceLevel: true, authorUserId: true, recordedAt: true, effectiveFrom: true, effectiveUntil: true, establishedAt: true, supersedesFactId: true, supersededByFactId: true } satisfies Prisma.GovernedMemoryFactSelect;
const decisionSelect = { id: true, title: true, rationale: true, status: true, decidedByUserId: true, validatedByUserId: true, decidedAt: true, validatedAt: true, recordedAt: true, effectiveFrom: true, effectiveUntil: true, consequences: true, reservations: true } satisfies Prisma.GovernedMemoryDecisionSelect;
const sourceSelect = { id: true, governedJourneyId: true, governedJourneyEventId: true, kind: true, status: true, title: true, authoredAt: true, receivedAt: true, recordedAt: true, visibilityPolicyRef: true, unavailableReason: true } satisfies Prisma.GovernedMemorySourceSelect;
const relationSelect = { id: true, type: true, sourceType: true, sourceId: true, targetType: true, targetId: true, createdAt: true } satisfies Prisma.GovernedMemoryRelationSelect;
const validationSelect = { id: true, targetType: true, targetId: true, validatorUserId: true, validatorRole: true, decision: true, rationale: true, reservations: true, validatedAt: true, createdAt: true } satisfies Prisma.GovernedMemoryValidationSelect;
const disputeSelect = { id: true, targetType: true, targetId: true, raisedByUserId: true, reason: true, status: true, raisedAt: true, resolvedAt: true, resolvedByUserId: true, resolution: true, createdAt: true } satisfies Prisma.GovernedMemoryDisputeSelect;
const eventSelect = { id: true, type: true, actorType: true, actorUserId: true, objectType: true, objectId: true, occurredAt: true, recordedAt: true, summary: true } satisfies Prisma.GovernedMemoryEventSelect;
const grantSelect = { id: true, subjectType: true, subjectUserId: true, subjectRepresentationId: true, permission: true, resourceType: true, resourceId: true, effectiveFrom: true, effectiveUntil: true, revokedAt: true, residualPermission: true, residualEffectiveUntil: true } satisfies Prisma.GovernedMemoryAccessGrantSelect;
const roleSelect = { id: true, userId: true, role: true, assignedAt: true, revokedAt: true } satisfies Prisma.GovernedMemoryRoleAssignmentSelect;

function createTransactionalReader(tx: Tx) {
  return {
    async resolveCurrentAccess(relationCaseId: string, userId: string, now: Date): Promise<ResolvedMemoryPermissions | null> {
      const memoryCase = await tx.relationCase.findUnique({ where: { id: relationCaseId }, select: { id: true, ownerId: true, governanceStatus: true } });
      if (!memoryCase || memoryCase.governanceStatus === "BLOCKED") return null;
      const representationIds = await tx.representation.findMany({ where: { ownerId: userId }, select: { id: true }, orderBy: { id: "asc" } }).then((rows) => rows.map(({ id }) => id));
      const [roles, grants] = await Promise.all([
        tx.governedMemoryRoleAssignment.findMany({ where: { relationCaseId, userId, assignedAt: { lte: now }, OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] }, select: { role: true }, orderBy: [{ role: "asc" }, { assignedAt: "asc" }] }),
        tx.governedMemoryAccessGrant.findMany({ where: { relationCaseId, effectiveFrom: { lte: now }, AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }, { OR: [{ revokedAt: null }, { revokedAt: { gt: now } }] }, { OR: [{ subjectType: "USER", subjectUserId: userId }, { subjectType: "REPRESENTATION", subjectRepresentationId: { in: representationIds } }] }] }, select: grantSelect, orderBy: [{ permission: "asc" }, { effectiveFrom: "asc" }, { id: "asc" }] }),
      ]);
      const permissions = new Set<Prisma.GovernedMemoryAccessGrantGetPayload<{ select: typeof grantSelect }>["permission"]>();
      if (memoryCase.ownerId === userId) for (const permission of ROLE_PERMISSIONS.RELATION_CASE_OWNER) permissions.add(permission);
      for (const { role } of roles) for (const permission of ROLE_PERMISSIONS[role]) permissions.add(permission);
      for (const grant of grants) if (!grant.resourceType && !grant.resourceId) permissions.add(grant.permission);
      return { relationCaseId, userId, permissions, sourceResourceIds: new Set(grants.filter((grant) => grant.resourceType === "SOURCE" && grant.resourceId).map((grant) => grant.resourceId as string)), isOwner: memoryCase.ownerId === userId };
    },
    async readSnapshot(input: { relationCaseId: string; referenceDate: Date; knowledgeCutoff: Date; limit: number; cursor: ReadCursor | null }) {
      const take = input.limit + 1;
      const afterCursor = input.cursor ? { OR: [{ recordedAt: { gt: new Date(input.cursor.recordedAt) } }, { recordedAt: new Date(input.cursor.recordedAt), id: { gt: input.cursor.id } }] } : {};
      const memoryCase = await tx.relationCase.findUnique({ where: { id: input.relationCaseId }, select: { id: true, ownerId: true, governanceStatus: true } });
      if (!memoryCase) return null;
      const [facts, decisions, sources, relations, validations, disputes, events, grants, roles] = await Promise.all([
        tx.governedMemoryFact.findMany({ where: { relationCaseId: input.relationCaseId, recordedAt: { lte: input.knowledgeCutoff }, effectiveFrom: { lte: input.referenceDate }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: input.referenceDate } }], ...afterCursor }, select: factSelect, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], take }),
        tx.governedMemoryDecision.findMany({ where: { relationCaseId: input.relationCaseId, recordedAt: { lte: input.knowledgeCutoff }, effectiveFrom: { lte: input.referenceDate }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: input.referenceDate } }] }, select: decisionSelect, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], take }),
        tx.governedMemorySource.findMany({ where: { relationCaseId: input.relationCaseId, recordedAt: { lte: input.knowledgeCutoff } }, select: sourceSelect, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], take }),
        tx.governedMemoryRelation.findMany({ where: { relationCaseId: input.relationCaseId, createdAt: { lte: input.knowledgeCutoff } }, select: relationSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1000 }),
        tx.governedMemoryValidation.findMany({ where: { relationCaseId: input.relationCaseId, createdAt: { lte: input.knowledgeCutoff } }, select: validationSelect, orderBy: [{ validatedAt: "asc" }, { id: "asc" }], take: 500 }),
        tx.governedMemoryDispute.findMany({ where: { relationCaseId: input.relationCaseId, raisedAt: { lte: input.knowledgeCutoff } }, select: disputeSelect, orderBy: [{ raisedAt: "asc" }, { id: "asc" }], take: 500 }),
        tx.governedMemoryEvent.findMany({ where: { relationCaseId: input.relationCaseId, recordedAt: { lte: input.knowledgeCutoff } }, select: eventSelect, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], take: 501 }),
        tx.governedMemoryAccessGrant.findMany({ where: { relationCaseId: input.relationCaseId, effectiveFrom: { lte: input.referenceDate } }, select: grantSelect, orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }], take: 500 }),
        tx.governedMemoryRoleAssignment.findMany({ where: { relationCaseId: input.relationCaseId, assignedAt: { lte: input.referenceDate } }, select: roleSelect, orderBy: [{ assignedAt: "asc" }, { id: "asc" }], take: 500 }),
      ]);
      return { memoryCase, facts, decisions, sources, relations, validations, disputes, events, grants, roles, truncated: { facts: facts.length > input.limit, decisions: decisions.length > input.limit, sources: sources.length > input.limit, timeline: events.length > 500, relations: relations.length === 1000, validations: validations.length === 500, disputes: disputes.length === 500, grants: grants.length === 500, roles: roles.length === 500 } };
    },
    async getDecisionTrace(relationCaseId: string, decisionId: string, knowledgeCutoff: Date) {
      const decision = await tx.governedMemoryDecision.findUnique({ where: { id_relationCaseId: { id: decisionId, relationCaseId } }, select: decisionSelect });
      if (!decision || decision.recordedAt > knowledgeCutoff) return null;
      const relations = await tx.governedMemoryRelation.findMany({ where: { relationCaseId, createdAt: { lte: knowledgeCutoff }, OR: [{ sourceType: "DECISION", sourceId: decisionId }, { targetType: "DECISION", targetId: decisionId }] }, select: relationSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200 });
      const factIds = relations.filter((row) => row.targetType === "FACT").map((row) => row.targetId); const sourceIds = relations.filter((row) => row.targetType === "SOURCE").map((row) => row.targetId); const priorIds = relations.filter((row) => row.targetType === "DECISION" && row.targetId !== decisionId).map((row) => row.targetId);
      const [facts, sources, priorDecisions, validations, disputes, events] = await Promise.all([
        tx.governedMemoryFact.findMany({ where: { relationCaseId, id: { in: factIds }, recordedAt: { lte: knowledgeCutoff } }, select: factSelect, orderBy: { id: "asc" }, take: 100 }), tx.governedMemorySource.findMany({ where: { relationCaseId, id: { in: sourceIds }, recordedAt: { lte: knowledgeCutoff } }, select: sourceSelect, orderBy: { id: "asc" }, take: 100 }), tx.governedMemoryDecision.findMany({ where: { relationCaseId, id: { in: priorIds }, recordedAt: { lte: knowledgeCutoff } }, select: decisionSelect, orderBy: { id: "asc" }, take: 100 }), tx.governedMemoryValidation.findMany({ where: { relationCaseId, targetType: "DECISION", targetId: decisionId, createdAt: { lte: knowledgeCutoff } }, select: validationSelect, orderBy: [{ validatedAt: "asc" }, { id: "asc" }], take: 100 }), tx.governedMemoryDispute.findMany({ where: { relationCaseId, targetType: "DECISION", targetId: decisionId, raisedAt: { lte: knowledgeCutoff } }, select: disputeSelect, orderBy: [{ raisedAt: "asc" }, { id: "asc" }], take: 100 }), tx.governedMemoryEvent.findMany({ where: { relationCaseId, objectType: "DECISION", objectId: decisionId, recordedAt: { lte: knowledgeCutoff } }, select: eventSelect, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], take: 200 }),
      ]);
      return { decision, relations, facts, sources, priorDecisions, validations, disputes, events };
    },
    async readTimeline(input: { relationCaseId: string; from: Date; to: Date; knowledgeCutoff: Date; limit: number; cursor: TimelineCursor | null; access: ResolvedMemoryPermissions }) {
      const targetedSources = [...input.access.sourceResourceIds];
      const sourceVisibility = input.access.permissions.has("VIEW_SOURCES")
        ? Prisma.sql`EXISTS (
            SELECT 1 FROM "GovernedMemorySource" source
            WHERE source."relationCaseId" = event."relationCaseId"
              AND source."id" = event."objectId"
              AND ((source."status" <> 'RESTRICTED' AND source."visibilityPolicyRef" IS NULL)
                OR source."id" IN (${targetedSources.length ? Prisma.join(targetedSources) : Prisma.sql`NULL`}))
          )`
        : Prisma.sql`FALSE`;
      const afterCursor = input.cursor
        ? Prisma.sql`AND (event."occurredAt" > ${new Date(input.cursor.occurredAt)} OR (event."occurredAt" = ${new Date(input.cursor.occurredAt)} AND event."id" > ${input.cursor.id}))`
        : Prisma.empty;
      return tx.$queryRaw<Array<Prisma.GovernedMemoryEventGetPayload<{ select: typeof eventSelect }>>>(Prisma.sql`
        SELECT event."id", event."type", event."actorType", event."actorUserId", event."objectType", event."objectId", event."occurredAt", event."recordedAt", event."summary"
        FROM "GovernedMemoryEvent" event
        WHERE event."relationCaseId" = ${input.relationCaseId}
          AND event."occurredAt" >= ${input.from}
          AND event."occurredAt" < ${input.to}
          AND event."recordedAt" <= ${input.knowledgeCutoff}
          ${afterCursor}
          AND (event."objectType" <> 'SOURCE' OR ${sourceVisibility})
        ORDER BY event."occurredAt" ASC, event."id" ASC
        LIMIT ${input.limit + 1}
      `);
    },
    async getObjectTrace(relationCaseId: string, objectType: "FACT" | "DECISION" | "SOURCE", objectId: string, cutoff: Date) {
      const relations = await tx.governedMemoryRelation.findMany({ where: { relationCaseId, createdAt: { lte: cutoff }, OR: [{ sourceType: objectType, sourceId: objectId }, { targetType: objectType, targetId: objectId }] }, select: relationSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200 });
      const [validations, disputes, events] = await Promise.all([tx.governedMemoryValidation.findMany({ where: { relationCaseId, targetType: objectType, targetId: objectId, createdAt: { lte: cutoff } }, select: validationSelect, orderBy: [{ validatedAt: "asc" }, { id: "asc" }], take: 200 }), tx.governedMemoryDispute.findMany({ where: { relationCaseId, targetType: objectType, targetId: objectId, raisedAt: { lte: cutoff } }, select: disputeSelect, orderBy: [{ raisedAt: "asc" }, { id: "asc" }], take: 200 }), tx.governedMemoryEvent.findMany({ where: { relationCaseId, objectType, objectId, recordedAt: { lte: cutoff } }, select: eventSelect, orderBy: [{ recordedAt: "asc" }, { id: "asc" }], take: 500 })]);
      return { relations, validations, disputes, events };
    },
  };
}

export type GovernedMemoryTransactionalReader = ReturnType<typeof createTransactionalReader>;
export type GovernedMemoryReadSnapshot = NonNullable<Awaited<ReturnType<GovernedMemoryTransactionalReader["readSnapshot"]>>>;
export type GovernedMemoryReadRepository = ReturnType<typeof createGovernedMemoryReadRepository>;

export function createGovernedMemoryReadRepository(database: Db = prisma) {
  return { runInSnapshot<T>(operation: (reader: GovernedMemoryTransactionalReader) => Promise<T>) { return database.$transaction((tx) => operation(createTransactionalReader(tx)), { isolationLevel: "RepeatableRead" }); } };
}

export const governedMemoryReadRepository = createGovernedMemoryReadRepository();
