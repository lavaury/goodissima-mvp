"use server";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function preparedMeeting(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = String(formData.get("formTemplateId") ?? "");
  const communicationSessionId = String(formData.get("communicationSessionId") ?? "");
  const form = await prisma.formTemplate.findFirst({ where: { id: formTemplateId, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { relationTemplateId: true } });
  const session = form?.relationTemplateId ? await prisma.communicationSession.findFirst({ where: { id: communicationSessionId, ownerId: owner.id, relationTemplateId: form.relationTemplateId, status: "PREPARED_NOT_STARTED" } }) : null;
  if (!session) throw new Error("Seule une réunion préparée non démarrée peut être modifiée.");
  return { formTemplateId, session };
}

export async function cancelGovernedMeetingAction(formData: FormData) {
  const { formTemplateId, session } = await preparedMeeting(formData);
  await prisma.communicationSession.update({ where: { id: session.id }, data: { status: "CANCELLED", accessOpened: false, metadata: { ...(session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata) ? session.metadata as Record<string, unknown> : {}), cancelledAt: new Date().toISOString(), cancellationKind: "MANUAL_OWNER", automaticNotificationSent: false } } });
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}

export async function updateGovernedMeetingScheduleAction(formData: FormData) {
  const { formTemplateId, session } = await preparedMeeting(formData);
  const input = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = new Date(input);
  if (!input || Number.isNaN(scheduledAt.getTime())) throw new Error("La nouvelle date prévue est invalide.");
  await prisma.communicationSession.update({ where: { id: session.id }, data: { scheduledAt, metadata: { ...(session.metadata && typeof session.metadata === "object" && !Array.isArray(session.metadata) ? session.metadata as Record<string, unknown> : {}), scheduleUpdatedAt: new Date().toISOString(), automaticNotificationSent: false } } });
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}
