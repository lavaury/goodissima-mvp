"use server";

import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTemplateReadAccess } from "@/lib/relation-template-access";

type ParticipantInvitationMetadata = {
  invitationId: string;
  participantName: string;
  participantRole: string;
  email: string | null;
  note: string | null;
  messageDraft: string;
  status: "PREPARED_NOT_SENT";
  deliveryMode: "MANUAL_OUT_OF_BAND";
  manualDeliveryRequired: true;
  preparedAt: string;
  updatedAt: string;
  preparedById: string;
  automaticEmailSent: false;
  accessOpened: false;
  tokenGenerated: false;
  linkGenerated: false;
};

function textFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function defaultMessageDraft(input: { journeyTitle: string; journeyObjective: string | null; participantRole: string; inviterName: string }) {
  return [
    "Bonjour,",
    "",
    `${input.inviterName} vous invite à participer au parcours « ${input.journeyTitle} ».`,
    ...(input.journeyObjective ? [`Objectif : ${input.journeyObjective}`] : []),
    `Rôle proposé : ${input.participantRole}.`,
    "Cette invitation concerne le parcours, pas automatiquement toutes ses réunions.",
    "Participer permet de consulter les éléments rendus accessibles et de contribuer selon le rôle attribué.",
    "Cette invitation n'a pas ete envoyee automatiquement par Goodissima.",
    "L’ouverture du lien ne vaut pas acceptation : vous pourrez accepter ou refuser explicitement après vous être identifié(e).",
  ].join("\n");
}

function existingInvitations(value: unknown): ParticipantInvitationMetadata[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const invitationId = typeof row.invitationId === "string" && row.invitationId.trim() ? row.invitationId.trim() : "";
      const participantName =
        typeof row.participantName === "string" && row.participantName.trim() ? row.participantName.trim() : "";
      const participantRole =
        typeof row.participantRole === "string" && row.participantRole.trim() ? row.participantRole.trim() : "";
      const preparedAt = typeof row.preparedAt === "string" && row.preparedAt.trim() ? row.preparedAt.trim() : "";
      const preparedById = typeof row.preparedById === "string" && row.preparedById.trim() ? row.preparedById.trim() : "";
      if (!invitationId || !participantName || !participantRole || !preparedAt || !preparedById) return null;

      return {
        invitationId,
        participantName,
        participantRole,
        email: typeof row.email === "string" && row.email.trim() ? row.email.trim() : null,
        note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
        messageDraft: typeof row.messageDraft === "string" && row.messageDraft.trim() ? row.messageDraft.trim() : "",
        status: "PREPARED_NOT_SENT" as const,
        deliveryMode: "MANUAL_OUT_OF_BAND" as const,
        manualDeliveryRequired: true as const,
        preparedAt,
        updatedAt: typeof row.updatedAt === "string" && row.updatedAt.trim() ? row.updatedAt.trim() : preparedAt,
        preparedById,
        automaticEmailSent: false as const,
        accessOpened: false as const,
        tokenGenerated: false as const,
        linkGenerated: false as const,
      };
    })
    .filter((item): item is ParticipantInvitationMetadata => item !== null);
}

function participantKey(name: string, role: string) {
  return `${name.trim().toLowerCase()}::${role.trim().toLowerCase()}`;
}

export async function prepareParticipantInvitationAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const participantName = textFromForm(formData, "participantName");
  const participantRole = textFromForm(formData, "participantRole");
  const optionalEmail = textFromForm(formData, "optionalEmail");
  const optionalNote = textFromForm(formData, "optionalNote");
  const submittedMessageDraft = textFromForm(formData, "messageDraft");

  if (!formTemplateId || !participantName || !participantRole) {
    throw new Error("Informations participant incompletes.");
  }
  if (!await getTemplateReadAccess(owner, formTemplateId)) throw new Error("Parcours introuvable.");

  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: formTemplateId },
    include: {
      relationTemplate: {
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const latestVersion = formTemplate?.relationTemplate?.versions[0];
  if (!formTemplate || !latestVersion) {
    throw new Error("Parcours introuvable.");
  }

  const snapshot = asRecord(latestVersion.snapshot);
  const metadata = asRecord(snapshot.metadata);
  const creationPlan = asRecord(metadata.creationPlan);
  const journeyTitle =
    (typeof creationPlan.title === "string" && creationPlan.title.trim()) ||
    formTemplate.name ||
    "Parcours gouverne";
  const journeyObjective =
    (typeof creationPlan.objective === "string" && creationPlan.objective.trim()) ||
    formTemplate.description?.trim() || null;
  const currentInvitations = existingInvitations(metadata.participantInvitations);
  const key = participantKey(participantName, participantRole);
  const previous = currentInvitations.find((invitation) =>
    participantKey(invitation.participantName, invitation.participantRole) === key
  );
  const now = new Date().toISOString();
  const messageDraft =
    submittedMessageDraft ||
    previous?.messageDraft ||
    defaultMessageDraft({ journeyTitle, journeyObjective, participantRole, inviterName: owner.name || owner.email });

  const preparedInvitation: ParticipantInvitationMetadata = {
    invitationId: previous?.invitationId ?? `prepared-${randomUUID()}`,
    participantName,
    participantRole,
    email: optionalEmail || null,
    note: optionalNote || null,
    messageDraft,
    status: "PREPARED_NOT_SENT",
    deliveryMode: "MANUAL_OUT_OF_BAND",
    manualDeliveryRequired: true,
    preparedAt: previous?.preparedAt ?? now,
    updatedAt: now,
    preparedById: owner.id,
    automaticEmailSent: false,
    accessOpened: false,
    tokenGenerated: false,
    linkGenerated: false,
  };

  const participantInvitations = [
    ...currentInvitations.filter((invitation) => participantKey(invitation.participantName, invitation.participantRole) !== key),
    preparedInvitation,
  ];

  await prisma.templateVersion.update({
    where: { id: latestVersion.id },
    data: {
      snapshot: {
        ...snapshot,
        metadata: {
          ...metadata,
          participantInvitations,
        },
      } as Prisma.InputJsonObject,
    },
  });

  const path = `/gouvernance/parcours/${formTemplate.id}/pilotage`;
  revalidatePath(path);
  redirect(path);
}
