"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCurrentJourneyAccess } from "@/lib/governed-journey-consent";
import { createPendingMeetingRsvp } from "@/lib/governed-meeting-rsvp";

async function governedMeetingScope(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = String(formData.get("formTemplateId") ?? "");
  const communicationSessionId = String(formData.get("communicationSessionId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");
  const [form, session, invitation] = await Promise.all([
    prisma.formTemplate.findFirst({ where: { id: formTemplateId, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { relationTemplateId: true } }),
    prisma.communicationSession.findFirst({ where: { id: communicationSessionId, ownerId: owner.id }, select: { id: true, relationTemplateId: true, status: true, expiresAt: true, rsvpRevision: true } }),
    prisma.governedJourneyInvitation.findFirst({ where: { id: invitationId, ownerId: owner.id }, include: { consent: true } }),
  ]);
  if (!form?.relationTemplateId || !session || session.relationTemplateId !== form.relationTemplateId || !invitation || invitation.relationTemplateId !== form.relationTemplateId) throw new Error("Réunion ou invitation hors du parcours gouverné.");
  if (session.status === "COMPLETED" || session.status === "CANCELLED" || (session.expiresAt && session.expiresAt <= new Date())) throw new Error("Le périmètre de cette réunion est verrouillé.");
  return { owner, formTemplateId, session, invitation };
}

export async function authorizeGuestForGovernedMeetingAction(formData: FormData) {
  const { owner, formTemplateId, session, invitation } = await governedMeetingScope(formData);
  if (!hasCurrentJourneyAccess(invitation)) throw new Error("Cette invitation n’a pas encore été acceptée, ou elle est révoquée ou expirée.");
  await prisma.$transaction(async (tx) => {
    const participant = await tx.governedMeetingParticipant.upsert({ where: { communicationSessionId_governedJourneyInvitationId: { communicationSessionId: session.id, governedJourneyInvitationId: invitation.id } }, create: { communicationSessionId: session.id, governedJourneyInvitationId: invitation.id, status: "AUTHORIZED", authorizedById: owner.id }, update: { status: "AUTHORIZED", authorizedAt: new Date(), removedAt: null, authorizedById: owner.id }, include: { rsvp: true } });
    if (invitation.consent && !participant.rsvp) await createPendingMeetingRsvp(tx, { meetingParticipantId: participant.id, meetingRevision: session.rsvpRevision, actorUserId: owner.id });
  });
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}

export async function removeGuestFromGovernedMeetingAction(formData: FormData) {
  const { owner, formTemplateId, session, invitation } = await governedMeetingScope(formData);
  await prisma.governedMeetingParticipant.upsert({ where: { communicationSessionId_governedJourneyInvitationId: { communicationSessionId: session.id, governedJourneyInvitationId: invitation.id } }, create: { communicationSessionId: session.id, governedJourneyInvitationId: invitation.id, status: "REMOVED", authorizedById: owner.id, removedAt: new Date() }, update: { status: "REMOVED", removedAt: new Date(), authorizedById: owner.id } });
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}
