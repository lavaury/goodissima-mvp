"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function scopedMeeting(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = String(formData.get("formTemplateId") ?? "");
  const communicationSessionId = String(formData.get("communicationSessionId") ?? "");
  const form = await prisma.formTemplate.findFirst({ where: { id: formTemplateId, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { relationTemplateId: true } });
  const session = form?.relationTemplateId ? await prisma.communicationSession.findFirst({ where: { id: communicationSessionId, ownerId: owner.id, relationTemplateId: form.relationTemplateId } }) : null;
  if (!session) throw new Error("Réunion indisponible.");
  return { owner, formTemplateId, session };
}

export async function cancelGovernedMeetingAction(formData: FormData) {
  const { owner, formTemplateId, session } = await scopedMeeting(formData);
  if (session.status !== "CANCELLED") {
    if (session.status !== "PREPARED_NOT_STARTED") throw new Error("Seule une réunion préparée non démarrée peut être annulée.");
    await prisma.$transaction(async (tx) => {
      const won = await tx.communicationSession.updateMany({ where: { id: session.id, status: "PREPARED_NOT_STARTED" }, data: { status: "CANCELLED", accessOpened: false, metadata: { ...(session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata) ? session.metadata as Record<string, unknown> : {}), cancelledAt: new Date().toISOString(), cancellationKind: "MANUAL_OWNER", automaticNotificationSent: false } } });
      if (won.count !== 1) return;
      const rsvps = await tx.governedMeetingRsvp.findMany({ where: { meetingParticipant: { communicationSessionId: session.id } } });
      if (rsvps.length) await tx.governedMeetingRsvpEvent.createMany({ data: rsvps.map((rsvp) => ({ meetingParticipantId: rsvp.meetingParticipantId, rsvpId: rsvp.id, type: "MEETING_CANCELLED" as const, actorUserId: owner.id, actorKind: "ORGANIZER" as const, rsvpVersion: rsvp.version, meetingRevision: rsvp.meetingRevision })) });
    });
  }
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}

export async function updateGovernedMeetingScheduleAction(formData: FormData) {
  const { owner, formTemplateId, session } = await scopedMeeting(formData);
  if (session.status !== "PREPARED_NOT_STARTED") throw new Error("Seule une réunion préparée non démarrée peut être modifiée.");
  const input = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = new Date(input);
  if (!input || Number.isNaN(scheduledAt.getTime())) throw new Error("La nouvelle date prévue est invalide.");
  // V1: assigning the first date does not reset an invitation presented as “Date à définir”.
  const isSubstantial = session.scheduledAt !== null && session.scheduledAt.getTime() !== scheduledAt.getTime();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.communicationSession.update({ where: { id: session.id }, data: { scheduledAt, rsvpRevision: isSubstantial ? { increment: 1 } : undefined, metadata: { ...(session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata) ? session.metadata as Record<string, unknown> : {}), scheduleUpdatedAt: new Date().toISOString(), automaticNotificationSent: false } } });
    if (!isSubstantial) return;
    const rsvps = await tx.governedMeetingRsvp.findMany({ where: { meetingParticipant: { communicationSessionId: session.id } } });
    for (const rsvp of rsvps) {
      const reset = await tx.governedMeetingRsvp.update({ where: { id: rsvp.id }, data: { status: "PENDING", decidedAt: null, decidedByUserId: null, decidedByInvitationId: null, version: { increment: 1 }, meetingRevision: updated.rsvpRevision } });
      await tx.governedMeetingRsvpEvent.create({ data: { meetingParticipantId: rsvp.meetingParticipantId, rsvpId: rsvp.id, type: "RESET_TO_PENDING", actorUserId: owner.id, actorKind: "ORGANIZER", rsvpVersion: reset.version, meetingRevision: updated.rsvpRevision } });
    }
  });
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}
