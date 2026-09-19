import "server-only";
import { hasCurrentJourneyAccess } from "@/lib/governed-journey-access";
import { PrismaGovernedMemoryReadRepository } from "@/lib/governed-memory/repository";
import { readGovernedJourneyCurrentStateMemoryCounts } from "@/lib/governed-journey-current-state-memory";
import { prisma } from "@/lib/prisma";
import type { GovernedJourneyCurrentStateInput } from "@/lib/governed-journey-current-state";
import type { GovernedAIContextSnapshot, GovernedMemoryAIContextRepository } from "@/lib/ai/governance/context";

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown) { return Array.isArray(value) ? value : []; }

/** Prisma remains behind this server-only adapter; no ORM object crosses into AuthorizedAIContext. */
export class PrismaGovernedMemoryAIContextRepository implements GovernedMemoryAIContextRepository {
  async readAuthorizedSnapshot(input: Parameters<GovernedMemoryAIContextRepository["readAuthorizedSnapshot"]>[0]): Promise<GovernedAIContextSnapshot | null> {
    const now = new Date();
    const journey = await prisma.governedJourney.findUnique({
      where: { id: input.journeyId },
      select: {
        id: true, authorityUserId: true, relationTemplateId: true,
        formTemplate: { select: { fields: { where: { type: "FILE" }, select: { id: true } } } },
        createdFromTemplateVersion: { select: { snapshot: true } },
        expectedRoleAssignments: { where: { revokedAt: null }, select: { expectedRoleId: true } },
      },
    });
    if (!journey) return null;
    if (journey.authorityUserId !== input.actorId) {
      const invitation = await prisma.governedJourneyInvitation.findFirst({
        where: { relationTemplateId: journey.relationTemplateId, inviteeUserId: input.actorId },
        select: { status: true, revokedAt: true, accessTokenExpiresAt: true, consent: { select: { status: true } } },
        orderBy: { createdAt: "desc" },
      });
      if (!invitation || !hasCurrentJourneyAccess(invitation, now)) return null;
    }

    const memoryRepository = new PrismaGovernedMemoryReadRepository();
    const access = await memoryRepository.findJourneyAccess(journey.id, input.actorId, now);
    const roleGrantsMemory = Boolean(access?.roles.length);
    const canViewMemory = Boolean(access && (roleGrantsMemory || access.permissions.includes("VIEW_MEMORY")));
    const canViewSources = Boolean(canViewMemory && access && (roleGrantsMemory || access.permissions.includes("VIEW_SOURCES")));
    const needsMemoryObjects = input.capability !== "explainCurrentState";
    const records = needsMemoryObjects && canViewMemory && access
      ? await memoryRepository.readJourneyMemory(access.journeyId, access.relationCaseIds, access.wholeJourney, canViewSources)
      : { facts: [], decisions: [], sources: [], disputes: [], validations: [], relations: [], events: [], transitionRequests: [] };

    const [invitations, meetings] = await Promise.all([
      prisma.governedJourneyInvitation.findMany({
        where: { relationTemplateId: journey.relationTemplateId },
        select: { id: true, status: true, revokedAt: true, accessTokenExpiresAt: true, inviteeUserId: true, consent: { select: { status: true } } },
      }),
      prisma.communicationSession.findMany({
        where: { relationTemplateId: journey.relationTemplateId },
        select: { id: true, title: true, status: true, accessOpened: true, scheduledAt: true, expiresAt: true, meetingParticipants: { where: { status: "AUTHORIZED" }, select: { id: true } } },
      }),
    ]);
    const activeInvitations = invitations.filter((item) => hasCurrentJourneyAccess(item, now));
    const identities = new Set([`U:${journey.authorityUserId}`, ...activeInvitations.map((item) => item.inviteeUserId ? `U:${item.inviteeUserId}` : `I:${item.id}`)]);
    const snapshot = record(journey.createdFromTemplateVersion.snapshot);
    const metadata = record(snapshot.metadata);
    const plan = record(metadata.creationPlan);
    const plannedRoles = array(plan.participants ?? plan.actors);
    const plannedDocuments = array(plan.documents ?? plan.expectedDocuments);
    const receptions = array(metadata.documentReceptions);
    const reviews = array(metadata.governanceReviewPreparations).filter((item) => record(item).status !== "COMPLETED");
    // Current State keeps its exhaustive targeted count queries; the 100-row Memory read model is never used for its totals.
    const memory = canViewMemory ? await readGovernedJourneyCurrentStateMemoryCounts(journey.id, now) : null;
    const currentStateInput: GovernedJourneyCurrentStateInput = {
      memory, participantCount: identities.size, activeRoleCount: journey.expectedRoleAssignments.length,
      vacantRoleCount: Math.max(0, plannedRoles.length - journey.expectedRoleAssignments.length),
      expectedDocumentCount: plannedDocuments.length || journey.formTemplate?.fields.length || 0,
      receivedDocumentCount: receptions.length, pendingReviewCount: reviews.length,
      unscheduledMeetingCount: meetings.filter((item) => item.status === "PREPARED_NOT_STARTED" && !item.scheduledAt).length,
      meetingWithoutParticipantCount: meetings.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status) && item.meetingParticipants.length === 0).length,
      meetings: meetings.map(({ meetingParticipants: _participants, ...meeting }) => meeting), now,
    };
    return {
      journeyId: journey.id, ownerId: journey.authorityUserId, actorId: input.actorId, currentStateInput,
      canViewMemory, canViewSources,
      facts: canViewMemory ? records.facts.map((item) => ({ id: item.id, statement: item.statement, status: item.status, effectiveFrom: item.effectiveFrom, effectiveUntil: item.effectiveUntil })) : [],
      decisions: canViewMemory ? records.decisions.map((item) => ({ id: item.id, title: item.title, rationale: item.rationale, status: item.status, effectiveFrom: item.effectiveFrom, effectiveUntil: item.effectiveUntil })) : [],
      sources: canViewSources ? records.sources.map((item) => ({ id: item.id, title: item.title, kind: item.kind, status: item.status, excerpt: item.excerpt, recordedAt: item.recordedAt })) : [],
    };
  }
}
