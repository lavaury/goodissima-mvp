import { Prisma, type GovernedParticipantSelectionSource, type PrismaClient } from "@prisma/client";
import { createJourneyInvitationToken, hashJourneyInvitationToken } from "./governed-journey-invitations.ts";

export type JourneySelectionResult = { candidateId: string; status: "INVITED" | "ALREADY_INVITED" | "ALREADY_PRESENT" | "SKIPPED"; invitationId?: string };

export async function inviteSelectionToJourney(client: PrismaClient, input: { authorityUserId: string; journeyId: string; source: Extract<GovernedParticipantSelectionSource, "DIRECTORY" | "MATCHING">; candidateIds: string[] }) {
  const candidateIds = [...new Set(input.candidateIds)].slice(0, 100);
  if (!candidateIds.length) throw new Error("SELECTION_EMPTY");
  return client.$transaction(async (tx) => {
    const journey = await tx.governedJourney.findFirst({ where: { id: input.journeyId, authorityUserId: input.authorityUserId, status: { notIn: ["CLOSED", "CANCELLED"] } }, select: { id: true, relationTemplateId: true, relationTemplate: { select: { workspaceId: true } } } });
    if (!journey) throw new Error("JOURNEY_NOT_FOUND");
    const profiles = input.source === "DIRECTORY" ? await tx.directoryProfile.findMany({ where: { publicId: { in: candidateIds }, status: "PUBLISHED", actorType: "PERSON", deletedAt: null, subjectIdentity: { user: { isNot: null } } }, select: { id: true, publicId: true, publicName: true, subjectIdentity: { select: { user: { select: { id: true } } } } } }) : [];
    const byCandidate = new Map(profiles.flatMap((profile) => profile.subjectIdentity.user ? [[profile.publicId, { ...profile, userId: profile.subjectIdentity.user.id }] as const] : []));
    const userIds = profiles.flatMap((profile) => profile.subjectIdentity.user ? [profile.subjectIdentity.user.id] : []);
    const existing = userIds.length ? await tx.governedJourneyInvitation.findMany({ where: { ownerId: input.authorityUserId, relationTemplateId: journey.relationTemplateId, inviteeUserId: { in: userIds }, status: { in: ["PREPARED", "ACTIVE"] }, revokedAt: null, accessTokenExpiresAt: { gt: new Date() } }, include: { consent: true } }) : [];
    const selection = await tx.governedParticipantSelection.create({ data: { ownerId: input.authorityUserId, governedJourneyId: journey.id, relationTemplateId: journey.relationTemplateId, targetType: "JOURNEY", source: input.source, status: "VALIDATED", criteria: { candidateIds, confirmedByHuman: true }, createdByUserId: input.authorityUserId, validatedByUserId: input.authorityUserId, reviewStartedAt: new Date(), validatedAt: new Date(), version: 2 }, select: { id: true } });
    await tx.governedParticipantSelectionEvent.createMany({ data: [{ selectionId: selection.id, type: "CREATED", actorUserId: input.authorityUserId, version: 0 }, { selectionId: selection.id, type: "REVIEW_STARTED", actorUserId: input.authorityUserId, version: 1 }, { selectionId: selection.id, type: "VALIDATED", actorUserId: input.authorityUserId, version: 2 }] });
    const results: JourneySelectionResult[] = [];
    for (const candidateId of candidateIds) {
      const profile = byCandidate.get(candidateId);
      const prior = profile ? existing.find((item) => item.inviteeUserId === profile.userId) : null;
      let status: JourneySelectionResult["status"] = "SKIPPED"; let invitationId: string | undefined;
      if (prior) { status = prior.consent?.status === "ACCEPTED" || prior.status === "ACTIVE" ? "ALREADY_PRESENT" : "ALREADY_INVITED"; invitationId = prior.id; }
      else if (profile) {
        const token = createJourneyInvitationToken();
        const invitation = await tx.governedJourneyInvitation.create({ data: { ownerId: input.authorityUserId, workspaceId: journey.relationTemplate.workspaceId, relationTemplateId: journey.relationTemplateId, displayName: profile.publicName, role: "OTHER", status: "PREPARED", inviteeUserId: profile.userId, accessTokenHash: hashJourneyInvitationToken(token), accessTokenExpiresAt: new Date(Date.now() + 7 * 86400000), metadata: { directoryPublicId: profile.publicId, source: input.source, automaticEmailSent: false, automaticNotificationSent: false } }, select: { id: true } });
        await tx.governedJourneyConsent.create({ data: { invitationId: invitation.id, status: "PENDING" } });
        invitationId = invitation.id; status = "INVITED";
      }
      await tx.governedParticipantSelectionItem.create({ data: { selectionId: selection.id, relationTemplateId: journey.relationTemplateId, canonicalUserId: profile?.userId ?? null, canonicalDirectoryProfileId: profile?.id ?? null, sourceDirectoryProfileId: profile?.id ?? null, snapshotDisplayName: profile?.publicName ?? "Profil non invitable", observedEligibility: status === "ALREADY_PRESENT" ? "ALREADY_PRESENT" : status === "INVITED" ? "ELIGIBLE" : status === "ALREADY_INVITED" ? "PENDING_CONSENT" : "INELIGIBLE", decision: profile ? "INCLUDED" : "EXCLUDED", decisionReason: profile ? null : "Identité personnelle accessible non résolue", materializedJourneyInvitationId: status === "INVITED" ? invitationId : null, decidedAt: new Date() } });
      results.push({ candidateId, status, ...(invitationId ? { invitationId } : {}) });
    }
    const summary = { invited: results.filter((item) => item.status === "INVITED").length, alreadyInvited: results.filter((item) => item.status === "ALREADY_INVITED").length, alreadyPresent: results.filter((item) => item.status === "ALREADY_PRESENT").length, skipped: results.filter((item) => item.status === "SKIPPED").length };
    await tx.governedParticipantSelectionEvent.create({ data: { selectionId: selection.id, type: "MATERIALIZED", actorUserId: input.authorityUserId, version: 3, summary } });
    await tx.governedParticipantSelection.update({ where: { id: selection.id }, data: { status: "MATERIALIZED", materializedAt: new Date(), materializationSummary: summary, version: 3 } });
    return { selectionId: selection.id, results, summary };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
