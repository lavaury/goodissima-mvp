import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const governedJourneyReadSelect = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  suspendedAt: true,
  closedAt: true,
  cancelledAt: true,
} satisfies Prisma.GovernedJourneySelect;

export const governedJourneyEventReadSelect = {
  type: true,
  fromStatus: true,
  toStatus: true,
  sequence: true,
  occurredAt: true,
} satisfies Prisma.GovernedJourneyEventSelect;

export type GovernedJourneyReadRow = Prisma.GovernedJourneyGetPayload<{ select: typeof governedJourneyReadSelect }>;
export type GovernedJourneyEventReadRow = Prisma.GovernedJourneyEventGetPayload<{ select: typeof governedJourneyEventReadSelect }>;
export type GovernedJourneyReadCursor = { updatedAt: Date; id: string };

export type GovernedJourneyReadRepository = {
  listOwned(input: {
    relationCaseId: string;
    requesterUserId: string;
    limit: number;
    cursor: GovernedJourneyReadCursor | null;
  }): Promise<{ rows: GovernedJourneyReadRow[]; authorized: boolean }>;
  detailOwned(input: {
    relationCaseId: string;
    journeyId: string;
    requesterUserId: string;
  }): Promise<{ journey: GovernedJourneyReadRow; events: GovernedJourneyEventReadRow[] } | null>;
};

export function createGovernedJourneyReadRepository(database: PrismaClient = prisma): GovernedJourneyReadRepository {
  return {
    async listOwned(input) {
      return database.$transaction(async (tx) => {
        const ownedCase = await tx.relationCase.findFirst({
          where: { id: input.relationCaseId, ownerId: input.requesterUserId },
          select: { id: true },
        });
        if (!ownedCase) return { rows: [], authorized: false };

        const cursorWhere: Prisma.GovernedJourneyWhereInput | undefined = input.cursor
          ? {
              OR: [
                { updatedAt: { lt: input.cursor.updatedAt } },
                { updatedAt: input.cursor.updatedAt, id: { lt: input.cursor.id } },
              ],
            }
          : undefined;
        const rows = await tx.governedJourney.findMany({
          where: { relationCaseId: input.relationCaseId, ...cursorWhere },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: input.limit + 1,
          select: governedJourneyReadSelect,
        });
        return { rows, authorized: true };
      }, { isolationLevel: "RepeatableRead" });
    },

    async detailOwned(input) {
      return database.$transaction(async (tx) => {
        const ownedCase = await tx.relationCase.findFirst({
          where: { id: input.relationCaseId, ownerId: input.requesterUserId },
          select: { id: true },
        });
        if (!ownedCase) return null;

        const journey = await tx.governedJourney.findFirst({
          where: { id: input.journeyId, relationCaseId: input.relationCaseId },
          select: governedJourneyReadSelect,
        });
        if (!journey) return null;
        const events = await tx.governedJourneyEvent.findMany({
          where: { governedJourneyId: input.journeyId, relationCaseId: input.relationCaseId },
          orderBy: { sequence: "asc" },
          select: governedJourneyEventReadSelect,
        });
        return { journey, events };
      }, { isolationLevel: "RepeatableRead" });
    },
  };
}

export const governedJourneyReadRepository = createGovernedJourneyReadRepository();
