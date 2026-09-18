import "server-only";
import { getCurrentPrismaUser } from "@/lib/auth";
import { PrismaGovernedMemoryReadRepository } from "@/lib/governed-memory/repository";
import { prisma } from "@/lib/prisma";
import type { CurrentStateMemoryCounts } from "@/lib/governed-journey-current-state";

export async function readGovernedJourneyCurrentStateMemoryCounts(journeyId: string, now = new Date()): Promise<CurrentStateMemoryCounts | null> {
  const user = await getCurrentPrismaUser();
  const access = await new PrismaGovernedMemoryReadRepository().findJourneyAccess(journeyId, user.id, now);
  const roleGrantsMemory = Boolean(access?.roles.length);
  if (!access || (!roleGrantsMemory && !access.permissions.includes("VIEW_MEMORY"))) return null;

  const scope = access.wholeJourney
    ? { governedJourneyId: access.journeyId }
    : { governedJourneyId: access.journeyId, relationCaseId: { in: access.relationCaseIds } };
  const applicable = { effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] };
  const canViewSources = roleGrantsMemory || access.permissions.includes("VIEW_SOURCES");

  const [decisionsInForce, draftDecisions, disputedDecisions, establishedFacts, disputedFacts, proposedFacts] = await prisma.$transaction([
    prisma.governedMemoryDecision.count({ where: { ...scope, status: "VALIDATED", ...applicable } }),
    prisma.governedMemoryDecision.count({ where: { ...scope, status: "DRAFT" } }),
    prisma.governedMemoryDispute.count({ where: { ...scope, targetType: "DECISION", status: "OPEN" } }),
    prisma.governedMemoryFact.count({ where: { ...scope, status: "ESTABLISHED", supersededByFactId: null, ...applicable } }),
    prisma.governedMemoryFact.count({ where: { ...scope, status: "DISPUTED", supersededByFactId: null, ...applicable } }),
    prisma.governedMemoryFact.count({ where: { ...scope, status: "PROPOSED" } }),
  ]);
  const activeSources = canViewSources
    ? await prisma.governedMemorySource.count({ where: { ...scope, status: "ACTIVE", unavailableReason: null } })
    : null;

  return { decisionsInForce, draftDecisions, disputedDecisions, establishedFacts, disputedFacts, proposedFacts, activeSources };
}
