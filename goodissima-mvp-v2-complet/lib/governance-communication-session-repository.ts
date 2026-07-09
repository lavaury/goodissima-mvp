import type {
  CommunicationChannelType,
  CommunicationProvider,
  CommunicationSessionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GovernanceCommunicationSessionScope = "JOURNEY" | "WORKSPACE";

export type GovernanceCommunicationSessionItem = {
  id: string;
  scope: GovernanceCommunicationSessionScope;
  channelType: CommunicationChannelType;
  channelLabel: string;
  provider: CommunicationProvider;
  providerLabel: string;
  status: CommunicationSessionStatus;
  statusLabel: string;
  title: string;
  purpose: string | null;
  note: string | null;
  externalUrl: string | null;
  scheduledAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  recordingEnabled: boolean;
  transcriptionRequested: boolean;
  transcriptionConsented: boolean;
  automaticNotificationSent: boolean;
  tokenGenerated: boolean;
  accessOpened: boolean;
  workflowStarted: boolean;
};

export type GovernanceCommunicationSessionOverview = {
  sessions: GovernanceCommunicationSessionItem[];
  preparedCount: number;
  completedCount: number;
  expiredCount: number;
  invitationPreparedCount: number;
};

export const governanceCommunicationChannelLabels: Record<CommunicationChannelType, string> = {
  VOICE_IP: "Audio",
  VIDEO_IP: "Visio",
  SCREEN_SHARE: "Partage ecran",
};

export const governanceCommunicationProviderLabels: Record<CommunicationProvider, string> = {
  NONE: "Aucun media multi-acteurs branche depuis la gouvernance en V1",
  MANUAL_EXTERNAL: "WebRTC navigateur",
  LIVEKIT_PENDING: "Provider media dedie non branche",
};

export function governanceCommunicationStatusLabel(input: {
  status: CommunicationSessionStatus;
  expiresAt: Date | null;
  provider: CommunicationProvider;
  accessOpened: boolean;
}) {
  if (input.status === "COMPLETED") return "Terminee";
  if (input.status === "CANCELLED") return input.expiresAt ? "Expiree" : "Annulee";
  if (input.expiresAt && input.expiresAt <= new Date()) return "Expiree";
  if (input.status === "REQUESTED" && (input.provider === "MANUAL_EXTERNAL" || input.accessOpened)) return "En cours";
  if (input.status === "REQUESTED") return "Preparee - non demarree";
  return "Preparee - non demarree";
}

function sessionScope(session: { relationTemplateId: string | null }, relationTemplateId: string) {
  if (session.relationTemplateId === relationTemplateId) return "JOURNEY" as const;
  return "WORKSPACE" as const;
}

export async function getGovernanceCommunicationOverview(input: {
  ownerId: string;
  relationTemplateId: string;
  workspaceId: string | null;
  invitationPreparedCount?: number;
}): Promise<GovernanceCommunicationSessionOverview> {
  const sessions = await prisma.communicationSession.findMany({
    where: {
      ownerId: input.ownerId,
      OR: [
        { relationTemplateId: input.relationTemplateId },
        ...(input.workspaceId ? [{ workspaceId: input.workspaceId, relationTemplateId: input.relationTemplateId }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      workspaceId: true,
      relationTemplateId: true,
      channelType: true,
      provider: true,
      status: true,
      title: true,
      purpose: true,
      note: true,
      externalUrl: true,
      scheduledAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      recordingEnabled: true,
      transcriptionRequested: true,
      transcriptionConsented: true,
      automaticNotificationSent: true,
      tokenGenerated: true,
      accessOpened: true,
      workflowStarted: true,
    },
  });

  const deduped = Array.from(new Map(sessions.map((session) => [session.id, session])).values());
  const items = deduped.map((session): GovernanceCommunicationSessionItem => {
    return {
      ...session,
      scope: sessionScope(session, input.relationTemplateId),
      channelLabel: governanceCommunicationChannelLabels[session.channelType],
      providerLabel: governanceCommunicationProviderLabels[session.provider],
      statusLabel: governanceCommunicationStatusLabel({
        status: session.status,
        expiresAt: session.expiresAt,
        provider: session.provider,
        accessOpened: session.accessOpened,
      }),
    };
  });

  return {
    sessions: items,
    preparedCount: items.filter((session) => session.statusLabel === "Preparee - non demarree" || session.statusLabel === "En cours").length,
    completedCount: items.filter((session) => session.statusLabel === "Terminee").length,
    expiredCount: items.filter((session) => session.statusLabel === "Expiree").length,
    invitationPreparedCount: input.invitationPreparedCount ?? 0,
  };
}
