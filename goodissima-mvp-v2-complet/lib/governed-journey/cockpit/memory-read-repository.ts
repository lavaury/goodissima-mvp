import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const sourceSelect = {
  id: true, kind: true, status: true, title: true, excerpt: true, recordedAt: true, relationCaseId: true,
  visibilityPolicyRef: true, governedJourneyEvent: { select: { occurredAt: true } },
} satisfies Prisma.GovernedMemorySourceSelect;
const relationSelect = { sourceType: true, sourceId: true, targetType: true, targetId: true } satisfies Prisma.GovernedMemoryRelationSelect;
const factSelect = { id: true, statement: true, status: true, recordedAt: true, updatedAt: true, governedJourneyId: true, relationCaseId: true } satisfies Prisma.GovernedMemoryFactSelect;
const decisionSelect = { id: true, title: true, rationale: true, status: true, recordedAt: true, updatedAt: true, validatedAt: true, governedJourneyId: true, relationCaseId: true } satisfies Prisma.GovernedMemoryDecisionSelect;
const validationSelect = { targetType: true, targetId: true, decision: true, validatedAt: true } satisfies Prisma.GovernedMemoryValidationSelect;
const disputeSelect = { targetType: true, targetId: true, status: true, raisedAt: true } satisfies Prisma.GovernedMemoryDisputeSelect;

export type GovernedMemoryCockpitRows = {
  sources: Prisma.GovernedMemorySourceGetPayload<{ select: typeof sourceSelect }>[];
  relations: Prisma.GovernedMemoryRelationGetPayload<{ select: typeof relationSelect }>[];
  facts: Prisma.GovernedMemoryFactGetPayload<{ select: typeof factSelect }>[];
  decisions: Prisma.GovernedMemoryDecisionGetPayload<{ select: typeof decisionSelect }>[];
  validations: Prisma.GovernedMemoryValidationGetPayload<{ select: typeof validationSelect }>[];
  disputes: Prisma.GovernedMemoryDisputeGetPayload<{ select: typeof disputeSelect }>[];
};

export function createGovernedMemoryCockpitRepository(database: PrismaClient = prisma) {
  return {
    async resolveRoot(input: { formTemplateId: string; workspaceId: string; requesterUserId: string }) {
      return database.formTemplate.findFirst({
        where: {
          id: input.formTemplateId,
          relationTemplate: { workspaceId: input.workspaceId, workspace: { ownerId: input.requesterUserId, status: "ACTIVE" } },
        },
        select: {
          relationTemplate: { select: { id: true, governedJourney: { select: { id: true, relationCaseId: true } } } },
        },
      });
    },

    listActiveJourneyMemoryRoles(input: { userId: string; governedJourneyId: string; relationTemplateId: string }) {
      return database.governedJourneyMemoryRoleAssignment.findMany({ where: { userId: input.userId, governedJourneyId: input.governedJourneyId, relationTemplateId: input.relationTemplateId, revokedAt: null, role: { in: ["MEMORY_STEWARD", "MEMORY_DELEGATE"] } }, select: { role: true } });
    },

    async listLinkedMemory(input: { governedJourneyId: string; relationCaseId: string | null }): Promise<GovernedMemoryCockpitRows> {
      const sources = await database.governedMemorySource.findMany({
        where: { governedJourneyId: input.governedJourneyId },
        select: sourceSelect,
        orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      });
      const sourceIds = sources.map(({ id }) => id);
      const relations = sourceIds.length && input.relationCaseId ? await database.governedMemoryRelation.findMany({
        where: {
          relationCaseId: input.relationCaseId,
          OR: [
            { sourceType: "SOURCE", sourceId: { in: sourceIds } },
            { targetType: "SOURCE", targetId: { in: sourceIds } },
          ],
        },
        select: relationSelect,
      }) : [];
      const linked = (type: "FACT" | "DECISION") => [...new Set(relations.flatMap((relation) => [
        relation.sourceType === type ? relation.sourceId : null,
        relation.targetType === type ? relation.targetId : null,
      ]).filter((id): id is string => Boolean(id)))];
      const factIds = linked("FACT");
      const decisionIds = linked("DECISION");
      const targets = [...sourceIds.map((id) => ({ targetType: "SOURCE" as const, targetId: id })),
        ...factIds.map((id) => ({ targetType: "FACT" as const, targetId: id })),
        ...decisionIds.map((id) => ({ targetType: "DECISION" as const, targetId: id }))];
      const [facts, decisions, validations, disputes] = await Promise.all([
        database.governedMemoryFact.findMany({ where: { OR: [{ governedJourneyId: input.governedJourneyId }, ...(input.relationCaseId && factIds.length ? [{ relationCaseId: input.relationCaseId, id: { in: factIds } }] : [])] }, select: factSelect }),
        database.governedMemoryDecision.findMany({ where: { OR: [{ governedJourneyId: input.governedJourneyId }, ...(input.relationCaseId && decisionIds.length ? [{ relationCaseId: input.relationCaseId, id: { in: decisionIds } }] : [])] }, select: decisionSelect }),
        targets.length ? database.governedMemoryValidation.findMany({
          where: { AND: [{ OR: [{ governedJourneyId: input.governedJourneyId }, ...(input.relationCaseId ? [{ relationCaseId: input.relationCaseId }] : [])] }, { OR: targets }] }, select: validationSelect,
          orderBy: [{ validatedAt: "desc" }, { id: "desc" }],
        }) : [],
        targets.length ? database.governedMemoryDispute.findMany({
          where: { AND: [{ OR: [{ governedJourneyId: input.governedJourneyId }, ...(input.relationCaseId ? [{ relationCaseId: input.relationCaseId }] : [])] }, { OR: targets }] }, select: disputeSelect,
          orderBy: [{ raisedAt: "desc" }, { id: "desc" }],
        }) : [],
      ]);
      return { sources, relations, facts, decisions, validations, disputes };
    },
  };
}

export const governedMemoryCockpitRepository = createGovernedMemoryCockpitRepository();
