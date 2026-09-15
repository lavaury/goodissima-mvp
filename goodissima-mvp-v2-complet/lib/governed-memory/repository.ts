import "server-only";
import { prisma } from "@/lib/prisma";

export const JOURNEY_MEMORY_PAGE_SIZE = 100;

export type MemoryPermission = "VIEW_MEMORY" | "VIEW_SOURCES" | "PROPOSE_FACT" | "ESTABLISH_FACT" | "DISPUTE_FACT" | "RECORD_DECISION" | "VALIDATE_DECISION" | "REGISTER_SOURCE";
export type MemoryRole = "MEMORY_STEWARD" | "MEMORY_DELEGATE";

export type JourneyMemoryAccessRecord = {
  journeyId: string;
  relationCaseIds: string[];
  wholeJourney: boolean;
  roles: MemoryRole[];
  permissions: MemoryPermission[];
};

export type JourneyMemoryRecords = {
  facts: any[];
  decisions: any[];
  sources: any[];
  disputes: any[];
  validations: any[];
  relations: any[];
  events: any[];
  transitionRequests: any[];
};

export interface GovernedMemoryReadRepository {
  findJourneyAccess(journeyId: string, userId: string, now: Date): Promise<JourneyMemoryAccessRecord | null>;
  readJourneyMemory(journeyId: string, relationCaseIds: string[], wholeJourney: boolean, includeSources: boolean): Promise<JourneyMemoryRecords>;
}

/** Read-only by construction: this repository deliberately exposes no create/update/delete method, especially for events. */
export class PrismaGovernedMemoryReadRepository implements GovernedMemoryReadRepository {
  async findJourneyAccess(journeyId: string, userId: string, now: Date): Promise<JourneyMemoryAccessRecord | null> {
    const journey = await prisma.governedJourney.findUnique({
      where: { id: journeyId },
      select: {
        id: true,
        memoryRoleAssignments: { where: { userId, revokedAt: null }, select: { role: true } },
        relationCaseContexts: { select: { relationCaseId: true } },
      },
    });
    if (!journey) return null;
    const relationCaseIds = journey.relationCaseContexts.map((row) => row.relationCaseId);
    const grants = relationCaseIds.length ? await prisma.governedMemoryAccessGrant.findMany({
      where: {
        relationCaseId: { in: relationCaseIds }, subjectType: "USER", subjectUserId: userId,
        revokedAt: null, effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      select: { permission: true, relationCaseId: true },
    }) : [];
    const roles = [...new Set(journey.memoryRoleAssignments.map((row) => row.role))] as MemoryRole[];
    const wholeJourney = roles.length > 0;
    const visibleCaseIds = wholeJourney ? relationCaseIds : [...new Set(grants.filter((grant) => grant.permission === "VIEW_MEMORY").map((grant) => grant.relationCaseId))];
    const permissions = [...new Set(grants.filter((grant) => visibleCaseIds.includes(grant.relationCaseId)).map((row) => row.permission).filter((permission): permission is MemoryPermission => permission !== "VALIDATE_SYNTHESIS" && permission !== "MANAGE_MEMORY_ACCESS" && permission !== "PROMOTE_PRIVATE_SOURCE"))];
    return { journeyId: journey.id, relationCaseIds: visibleCaseIds, wholeJourney, roles, permissions };
  }

  async readJourneyMemory(journeyId: string, relationCaseIds: string[], wholeJourney: boolean, includeSources: boolean): Promise<JourneyMemoryRecords> {
    const scoped = wholeJourney ? { governedJourneyId: journeyId } : { governedJourneyId: journeyId, relationCaseId: { in: relationCaseIds } };
    const relationScope = relationCaseIds.length ? { relationCaseId: { in: relationCaseIds } } : { relationCaseId: { in: [] as string[] } };
    const [facts, decisions, sources, disputes, validations, relations, events, transitionRequests] = await Promise.all([
      prisma.governedMemoryFact.findMany({ where: scoped, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: JOURNEY_MEMORY_PAGE_SIZE }),
      prisma.governedMemoryDecision.findMany({ where: scoped, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: JOURNEY_MEMORY_PAGE_SIZE }),
      includeSources ? prisma.governedMemorySource.findMany({ where: scoped, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: JOURNEY_MEMORY_PAGE_SIZE }) : Promise.resolve([]),
      prisma.governedMemoryDispute.findMany({ where: scoped, orderBy: [{ raisedAt: "desc" }, { id: "desc" }], take: JOURNEY_MEMORY_PAGE_SIZE }),
      prisma.governedMemoryValidation.findMany({ where: scoped, orderBy: [{ validatedAt: "desc" }, { id: "desc" }], take: JOURNEY_MEMORY_PAGE_SIZE }),
      prisma.governedMemoryRelation.findMany({ where: relationScope, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: JOURNEY_MEMORY_PAGE_SIZE }),
      // Append-only intent: events are selected and projected, never mutated through this API.
      prisma.governedMemoryEvent.findMany({ where: scoped, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: JOURNEY_MEMORY_PAGE_SIZE }),
      prisma.governedMemoryTransitionRequest.findMany({ where: scoped, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: JOURNEY_MEMORY_PAGE_SIZE }),
    ]);
    return { facts, decisions, sources, disputes, validations, relations, events, transitionRequests };
  }
}
