"use server";

import { redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { hasCurrentJourneyAccess } from "@/lib/governed-journey-consent";
import { createPendingMeetingRsvp } from "@/lib/governed-meeting-rsvp";
import { prisma } from "@/lib/prisma";
import { resolveOwnedGovernedJourney } from "@/lib/governed-journey-authority";

export async function reusePastGovernedMeetingAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = String(formData.get("formTemplateId") ?? "");
  const sourceSessionId = String(formData.get("sourceSessionId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const scheduledAtInput = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = new Date(scheduledAtInput);
  const selectedInvitationIds = [...new Set(formData.getAll("invitationIds").map(String).filter(Boolean))];
  if (!formTemplateId || !sourceSessionId || !title || !scheduledAtInput || Number.isNaN(scheduledAt.getTime())) throw new Error("Le titre et la nouvelle date sont obligatoires.");

  const scope = await resolveOwnedGovernedJourney(prisma, { formTemplateId, authorityUserId: owner.id });
  if (!scope || scope.status === "CLOSED" || scope.status === "CANCELLED") throw new Error("Parcours gouverné introuvable.");
  const relationTemplate = { id: scope.relationTemplateId, workspaceId: scope.workspaceId };

  const source = await prisma.communicationSession.findFirst({
    where: { id: sourceSessionId, ownerId: owner.id, relationTemplateId: relationTemplate.id, relationCaseId: null },
    select: { id: true, status: true, expiresAt: true, channelType: true },
  });
  const now = new Date();
  const sourceIsPast = Boolean(source && (source.status === "COMPLETED" || source.status === "CANCELLED" || (source.expiresAt && source.expiresAt <= now)));
  if (!source || !sourceIsPast) throw new Error("Seule une réunion passée peut être réutilisée.");

  const invitations = selectedInvitationIds.length > 0 ? await prisma.governedJourneyInvitation.findMany({
    where: { id: { in: selectedInvitationIds }, ownerId: owner.id, relationTemplateId: relationTemplate.id },
    include: { consent: true },
  }) : [];
  if (invitations.length !== selectedInvitationIds.length || invitations.some((invitation) => !hasCurrentJourneyAccess(invitation, now))) throw new Error("Un participant sélectionné ne dispose plus d’un accès valide au parcours.");

  const created = await prisma.$transaction(async (tx) => {
    const session = await tx.communicationSession.create({ data: {
      ownerId: owner.id,
      workspaceId: relationTemplate.workspaceId,
      relationTemplateId: relationTemplate.id,
      relationCaseId: null,
      channelType: source.channelType,
      provider: "NONE",
      status: "PREPARED_NOT_STARTED",
      title,
      purpose: purpose || null,
      note: note || null,
      externalUrl: null,
      scheduledAt,
      expiresAt: null,
      transcriptionRequested: false,
      transcriptionConsented: false,
      recordingEnabled: false,
      automaticNotificationSent: false,
      tokenGenerated: false,
      accessOpened: false,
      workflowStarted: false,
      metadata: { source: "reused-meeting-configuration-v1", selectedParticipantInvitationIds: selectedInvitationIds },
    } });
    for (const invitation of invitations) {
      const participant = await tx.governedMeetingParticipant.create({ data: { communicationSessionId: session.id, governedJourneyInvitationId: invitation.id, status: "AUTHORIZED", authorizedById: owner.id } });
      if (invitation.consent) await createPendingMeetingRsvp(tx, { meetingParticipantId: participant.id, meetingRevision: session.rsvpRevision, actorUserId: owner.id });
    }
    return session;
  });

  redirect(`/gouvernance/parcours/${formTemplateId}/pilotage?meetingPrepared=${encodeURIComponent(created.title)}#meeting-${created.id}`);
}
