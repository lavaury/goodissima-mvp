import type { GovernedMemoryRole, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type JourneyMemoryRole = Extract<GovernedMemoryRole, "MEMORY_STEWARD" | "MEMORY_DELEGATE">;

export function createJourneyMemoryRoleRepository(database: PrismaClient = prisma) {
  return {
    async hasActiveJourneyMemoryRole(input: {
      userId: string;
      governedJourneyId: string;
      relationTemplateId: string;
      allowedRoles: readonly JourneyMemoryRole[];
    }) {
      if (input.allowedRoles.length === 0) return false;
      return Boolean(await database.governedJourneyMemoryRoleAssignment.findFirst({
        where: {
          userId: input.userId,
          governedJourneyId: input.governedJourneyId,
          relationTemplateId: input.relationTemplateId,
          role: { in: [...input.allowedRoles] },
          revokedAt: null,
        },
        select: { id: true },
      }));
    },
  };
}

export const journeyMemoryRoleRepository = createJourneyMemoryRoleRepository();
