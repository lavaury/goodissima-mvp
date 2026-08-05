import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const internalGovernedJourneyLedgerSelect = {
  id: true,
  relationTemplateId: true,
  relationCaseId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdFromTemplateVersion: { select: { version: true } },
} satisfies Prisma.GovernedJourneySelect;

export const governedJourneyEventReadSelect = {
  type: true,
  fromStatus: true,
  toStatus: true,
  sequence: true,
  occurredAt: true,
} satisfies Prisma.GovernedJourneyEventSelect;

export type InternalGovernedJourneyLedgerRow = Prisma.GovernedJourneyGetPayload<{
  select: typeof internalGovernedJourneyLedgerSelect;
}>;
export type GovernedJourneyEventReadRow = Prisma.GovernedJourneyEventGetPayload<{
  select: typeof governedJourneyEventReadSelect;
}>;

type ScopedLookupInput = {
  workspaceId: string;
  requesterUserId: string;
};

export type GovernedJourneyReadRepository = {
  findOptionalByRelationTemplateId(input: ScopedLookupInput & {
    relationTemplateId: string;
  }): Promise<{ ledger: InternalGovernedJourneyLedgerRow | null } | null>;
  findOptionalByFormTemplateId(input: ScopedLookupInput & {
    formTemplateId: string;
  }): Promise<{
    formTemplateId: string;
    relationTemplateId: string;
    title: string;
    ledger: InternalGovernedJourneyLedgerRow | null;
  } | null>;
  listLegacyEvents(input: ScopedLookupInput & {
    governedJourneyId: string;
    relationCaseId: string;
  }): Promise<
    | { kind: "NOT_FOUND" }
    | { kind: "LEGACY_EVENT_LOG_UNAVAILABLE" }
    | { kind: "FOUND"; events: GovernedJourneyEventReadRow[] }
  >;
};

const activeOwnedWorkspace = (workspaceId: string, requesterUserId: string) => ({
  workspaceId,
  workspace: { ownerId: requesterUserId, status: "ACTIVE" as const },
});

export function createGovernedJourneyReadRepository(database: PrismaClient = prisma): GovernedJourneyReadRepository {
  return {
    async findOptionalByRelationTemplateId(input) {
      return database.relationTemplate.findFirst({
        where: {
          id: input.relationTemplateId,
          ...activeOwnedWorkspace(input.workspaceId, input.requesterUserId),
        },
        select: {
          governedJourney: { select: internalGovernedJourneyLedgerSelect },
        },
      }).then((row) => row ? { ledger: row.governedJourney } : null);
    },

    async findOptionalByFormTemplateId(input) {
      return database.formTemplate.findFirst({
        where: {
          id: input.formTemplateId,
          relationTemplate: activeOwnedWorkspace(input.workspaceId, input.requesterUserId),
        },
        select: {
          id: true,
          name: true,
          relationTemplateId: true,
          relationTemplate: {
            select: {
              id: true,
              governedJourney: { select: internalGovernedJourneyLedgerSelect },
            },
          },
        },
      }).then((row) => row?.relationTemplateId && row.relationTemplate ? {
        formTemplateId: row.id,
        relationTemplateId: row.relationTemplate.id,
        title: row.name,
        ledger: row.relationTemplate.governedJourney,
      } : null);
    },

    async listLegacyEvents(input) {
      const journey = await database.governedJourney.findFirst({
        where: {
          id: input.governedJourneyId,
          relationTemplate: activeOwnedWorkspace(input.workspaceId, input.requesterUserId),
        },
        select: {
          relationCaseId: true,
          events: {
            where: { relationCaseId: input.relationCaseId },
            orderBy: { sequence: "asc" },
            select: governedJourneyEventReadSelect,
          },
        },
      });
      if (!journey) return { kind: "NOT_FOUND" };
      if (journey.relationCaseId === null) return { kind: "LEGACY_EVENT_LOG_UNAVAILABLE" };
      if (journey.relationCaseId !== input.relationCaseId) return { kind: "NOT_FOUND" };
      return { kind: "FOUND", events: journey.events };
    },
  };
}

export const governedJourneyReadRepository = createGovernedJourneyReadRepository();
