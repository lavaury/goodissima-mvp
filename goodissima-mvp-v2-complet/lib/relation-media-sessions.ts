import type { CommunicationChannelType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RelationMediaSessionSummary = {
  id: string;
  workspaceId: string | null;
  relationCaseId: string | null;
  channelType: CommunicationChannelType;
  provider: string;
  status: string;
  title: string;
  recordingEnabled: boolean;
  transcriptionRequested: boolean;
  transcriptionConsented: boolean;
  automaticNotificationSent: boolean;
  tokenGenerated: boolean;
  accessOpened: boolean;
  workflowStarted: boolean;
  roomName: string;
};

export const relationMediaChannelTypes = new Set<CommunicationChannelType>(["VOICE_IP", "VIDEO_IP", "SCREEN_SHARE"]);

const channelTitles: Record<CommunicationChannelType, string> = {
  VOICE_IP: "Appel audio relationnel",
  VIDEO_IP: "Visio relationnelle",
  SCREEN_SHARE: "Partage d'ecran relationnel",
};

function roomNameFor(caseId: string, sessionId: string) {
  return `goodissima-case-${caseId}-session-${sessionId}`;
}

export function serializeRelationMediaSession(
  relationCaseId: string,
  session: {
    id: string;
    workspaceId: string | null;
    relationCaseId: string | null;
    channelType: CommunicationChannelType;
    provider: string;
    status: string;
    title: string;
    recordingEnabled: boolean;
    transcriptionRequested: boolean;
    transcriptionConsented: boolean;
    automaticNotificationSent: boolean;
    tokenGenerated: boolean;
    accessOpened: boolean;
    workflowStarted: boolean;
  },
): RelationMediaSessionSummary {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    relationCaseId: session.relationCaseId,
    channelType: session.channelType,
    provider: session.provider,
    status: session.status,
    title: session.title,
    recordingEnabled: session.recordingEnabled,
    transcriptionRequested: session.transcriptionRequested,
    transcriptionConsented: session.transcriptionConsented,
    automaticNotificationSent: session.automaticNotificationSent,
    tokenGenerated: session.tokenGenerated,
    accessOpened: session.accessOpened,
    workflowStarted: session.workflowStarted,
    roomName: roomNameFor(relationCaseId, session.id),
  };
}

export async function getOrCreateRelationMediaSession(input: {
  ownerId: string;
  relationCaseId: string;
  relationTemplateId: string | null;
  workspaceId: string | null;
  channelType: CommunicationChannelType;
}) {
  const existingSession = await prisma.communicationSession.findFirst({
    where: {
      ownerId: input.ownerId,
      relationCaseId: input.relationCaseId,
      status: {
        in: ["REQUESTED", "PREPARED_NOT_STARTED"],
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existingSession) {
    return prisma.communicationSession.update({
      where: {
        id: existingSession.id,
      },
      data: {
        workspaceId: input.workspaceId,
        relationTemplateId: input.relationTemplateId,
        channelType: input.channelType,
        provider: "MANUAL_EXTERNAL",
        status: "REQUESTED",
        note: "V1 WebRTC navigateur : signalisation HTTP controlee, aucun token public, aucun email, aucune notification.",
        recordingEnabled: false,
        transcriptionRequested: false,
        transcriptionConsented: false,
        automaticNotificationSent: false,
        tokenGenerated: false,
        accessOpened: true,
        workflowStarted: false,
      },
    });
  }

  return prisma.communicationSession.create({
    data: {
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      relationTemplateId: input.relationTemplateId,
      relationCaseId: input.relationCaseId,
      channelType: input.channelType,
      provider: "MANUAL_EXTERNAL",
      status: "REQUESTED",
      title: channelTitles[input.channelType],
      purpose: "Session relationnelle distante preparee depuis le dossier.",
      note: "V1 WebRTC navigateur : signalisation HTTP controlee, aucun token public, aucun email, aucune notification.",
      transcriptionRequested: false,
      transcriptionConsented: false,
      recordingEnabled: false,
      automaticNotificationSent: false,
      tokenGenerated: false,
      accessOpened: true,
      workflowStarted: false,
    },
  });
}

