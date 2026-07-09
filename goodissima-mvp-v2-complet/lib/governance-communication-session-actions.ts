"use server";

import { revalidatePath } from "next/cache";
import type { CommunicationChannelType } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const channelTypes = new Set<CommunicationChannelType>(["VOICE_IP", "VIDEO_IP", "SCREEN_SHARE"]);

function textFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function optionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Date de session invalide.");
  return date;
}

function optionalExternalUrl(value: string) {
  if (!value) return null;
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Le lien externe manuel doit etre une URL valide.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Le lien externe manuel doit commencer par http:// ou https://.");
  }

  return url.toString();
}

export async function prepareGovernanceCommunicationSessionAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const workspaceId = textFromForm(formData, "workspaceId");
  const channelTypeInput = textFromForm(formData, "channelType") as CommunicationChannelType;
  const title = textFromForm(formData, "title");
  const purpose = textFromForm(formData, "purpose");
  const note = textFromForm(formData, "note");
  const scheduledAt = optionalDate(textFromForm(formData, "scheduledAt"));
  const externalUrl = optionalExternalUrl(textFromForm(formData, "externalUrl"));

  if (!formTemplateId || !workspaceId || !title) {
    throw new Error("Le parcours, le Workspace et le titre sont obligatoires.");
  }

  if (!channelTypes.has(channelTypeInput)) {
    throw new Error("Type de communication invalide.");
  }

  const [formTemplate, workspace] = await Promise.all([
    prisma.formTemplate.findUnique({
      where: { id: formTemplateId },
      include: {
        relationTemplate: {
          include: {
            workspace: {
              select: {
                ownerId: true,
              },
            },
            versions: {
              orderBy: { version: "desc" },
              take: 1,
              select: {
                snapshot: true,
              },
            },
          },
        },
      },
    }),
    prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId: owner.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!formTemplate?.relationTemplate) {
    throw new Error("Parcours gouverne introuvable.");
  }

  if (!workspace) {
    throw new Error("Workspace cible introuvable pour cet utilisateur.");
  }

  const latestVersion = formTemplate.relationTemplate.versions[0];
  const metadata = asRecord(asRecord(latestVersion?.snapshot).metadata);
  const metadataOwnerId = typeof metadata.createdById === "string" ? metadata.createdById : null;
  const attachedWorkspaceOwnerId = formTemplate.relationTemplate.workspace?.ownerId ?? null;
  const journeyAttachedToWorkspace = formTemplate.relationTemplate.workspaceId === workspace.id;

  if (!journeyAttachedToWorkspace && metadataOwnerId !== owner.id && attachedWorkspaceOwnerId !== owner.id) {
    throw new Error("Ce parcours ne peut pas preparer une communication pour cet utilisateur.");
  }

  await prisma.communicationSession.create({
    data: {
      ownerId: owner.id,
      workspaceId: workspace.id,
      relationTemplateId: formTemplate.relationTemplate.id,
      channelType: channelTypeInput,
      provider: externalUrl ? "MANUAL_EXTERNAL" : "NONE",
      status: "PREPARED_NOT_STARTED",
      title,
      purpose: purpose || null,
      note: note || null,
      externalUrl,
      scheduledAt,
      transcriptionRequested: false,
      transcriptionConsented: false,
      recordingEnabled: false,
      automaticNotificationSent: false,
      tokenGenerated: false,
      accessOpened: false,
      workflowStarted: false,
    },
  });

  revalidatePath("/gouvernance");
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}
