import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const governedJourneyRelationCaseContextSelect = {
  governedJourneyId: true,
  relationTemplateId: true,
  relationCaseId: true,
  createdAt: true,
} satisfies Prisma.GovernedJourneyRelationCaseSelect;

export type GovernedJourneyRelationCaseContextRow = Prisma.GovernedJourneyRelationCaseGetPayload<{
  select: typeof governedJourneyRelationCaseContextSelect;
}>;

type ScopedContextReadInput = {
  workspaceId: string;
  requesterUserId: string;
};

export type GovernedJourneyRelationCaseContextRepository = {
  listByRelationTemplateId(input: ScopedContextReadInput & {
    relationTemplateId: string;
  }): Promise<{
    relationTemplateId: string;
    governedJourneyId: string | null;
    contexts: GovernedJourneyRelationCaseContextRow[];
  } | null>;
  listByFormTemplateId(input: ScopedContextReadInput & {
    formTemplateId: string;
  }): Promise<{
    formTemplateId: string;
    relationTemplateId: string;
    governedJourneyId: string | null;
    contexts: GovernedJourneyRelationCaseContextRow[];
  } | null>;
};

const activeOwnedWorkspace = (workspaceId: string, requesterUserId: string) => ({
  workspaceId,
  workspace: { ownerId: requesterUserId, status: "ACTIVE" as const },
});

const orderedContexts = {
  orderBy: [{ createdAt: "asc" as const }, { relationCaseId: "asc" as const }],
  select: governedJourneyRelationCaseContextSelect,
};

export function createGovernedJourneyRelationCaseContextRepository(
  database: PrismaClient = prisma,
): GovernedJourneyRelationCaseContextRepository {
  return {
    async listByRelationTemplateId(input) {
      const template = await database.relationTemplate.findFirst({
        where: {
          id: input.relationTemplateId,
          ...activeOwnedWorkspace(input.workspaceId, input.requesterUserId),
        },
        select: {
          id: true,
          governedJourney: {
            select: {
              id: true,
              relationCaseContexts: orderedContexts,
            },
          },
        },
      });
      if (!template) return null;
      return {
        relationTemplateId: template.id,
        governedJourneyId: template.governedJourney?.id ?? null,
        contexts: template.governedJourney?.relationCaseContexts ?? [],
      };
    },

    async listByFormTemplateId(input) {
      const formTemplate = await database.formTemplate.findFirst({
        where: {
          id: input.formTemplateId,
          relationTemplate: activeOwnedWorkspace(input.workspaceId, input.requesterUserId),
        },
        select: {
          id: true,
          relationTemplate: {
            select: {
              id: true,
              governedJourney: {
                select: {
                  id: true,
                  relationCaseContexts: orderedContexts,
                },
              },
            },
          },
        },
      });
      if (!formTemplate?.relationTemplate) return null;
      return {
        formTemplateId: formTemplate.id,
        relationTemplateId: formTemplate.relationTemplate.id,
        governedJourneyId: formTemplate.relationTemplate.governedJourney?.id ?? null,
        contexts: formTemplate.relationTemplate.governedJourney?.relationCaseContexts ?? [],
      };
    },
  };
}

export const governedJourneyRelationCaseContextRepository = createGovernedJourneyRelationCaseContextRepository();
