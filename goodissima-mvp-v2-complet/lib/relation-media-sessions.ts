import type { CommunicationChannelType, CommunicationSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const RELATION_MEDIA_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const relationMediaTerminalStatuses = new Set<CommunicationSessionStatus>(["CANCELLED", "COMPLETED"]);

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
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  roomName: string;
};

export const relationMediaChannelTypes = new Set<CommunicationChannelType>(["VOICE_IP", "VIDEO_IP", "SCREEN_SHARE"]);

const channelTitles: Record<CommunicationChannelType, string> = {
  VOICE_IP: "Appel audio relationnel",
  VIDEO_IP: "Visio relationnelle",
  SCREEN_SHARE: "Partage d'ecran relationnel",
};

function mergeMediaChannelType(current: CommunicationChannelType, next: CommunicationChannelType): CommunicationChannelType {
  if (current === next) return current;
  if (
    (current === "VIDEO_IP" && next === "SCREEN_SHARE") ||
    (current === "SCREEN_SHARE" && next === "VIDEO_IP")
  ) {
    return "VIDEO_IP";
  }
  if (next === "VIDEO_IP" || current === "VIDEO_IP") return "VIDEO_IP";
  return next;
}

function titleForMediaSession(channelType: CommunicationChannelType, usedScreenShare: boolean) {
  if (channelType === "VIDEO_IP" && usedScreenShare) return "Visio et partage d'ecran relationnels";
  return channelTitles[channelType];
}

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
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
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
    expiresAt: session.expiresAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    roomName: roomNameFor(relationCaseId, session.id),
  };
}

export function createRelationMediaSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + RELATION_MEDIA_SESSION_TTL_MS);
}

export function isRelationMediaSessionExpired(session: { expiresAt: Date | null }, now = new Date()) {
  return Boolean(session.expiresAt && session.expiresAt <= now);
}

export function isRelationMediaSessionTerminal(session: { status: CommunicationSessionStatus }) {
  return relationMediaTerminalStatuses.has(session.status);
}

export function getRelationMediaSessionBlockedReason(
  session: { status: CommunicationSessionStatus; expiresAt: Date | null },
  now = new Date(),
) {
  if (isRelationMediaSessionTerminal(session)) return "ended";
  if (isRelationMediaSessionExpired(session, now)) return "expired";
  return null;
}

export async function cancelExpiredRelationMediaSession(session: { id: string; expiresAt: Date | null; status: CommunicationSessionStatus }) {
  if (!isRelationMediaSessionExpired(session) || isRelationMediaSessionTerminal(session)) return session;

  return prisma.communicationSession.update({
    where: { id: session.id },
    data: {
      status: "CANCELLED",
      note: "Session expiree automatiquement par controle d'acces media. Aucun media, email, notification, enregistrement ou workflow automatique.",
      accessOpened: false,
    },
  });
}

export async function markRelationMediaSessionStarted(input: {
  sessionId: string;
  relationCaseId: string;
  channelType: CommunicationChannelType;
}) {
  const now = new Date();
  const session = await prisma.communicationSession.findFirst({
    where: {
      id: input.sessionId,
      relationCaseId: input.relationCaseId,
      status: {
        in: ["REQUESTED", "PREPARED_NOT_STARTED"],
      },
    },
  });

  if (!session) return null;

  const mergedChannelType = mergeMediaChannelType(session.channelType, input.channelType);
  const usedScreenShare = session.channelType === "SCREEN_SHARE" || input.channelType === "SCREEN_SHARE";

  return prisma.communicationSession.update({
    where: { id: session.id },
    data: {
      channelType: mergedChannelType,
      provider: "MANUAL_EXTERNAL",
      status: "REQUESTED",
      title: titleForMediaSession(mergedChannelType, usedScreenShare),
      expiresAt: session.expiresAt ?? createRelationMediaSessionExpiresAt(now),
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

export async function getOrCreateRelationMediaSession(input: {
  ownerId: string;
  relationCaseId: string;
  relationTemplateId: string | null;
  workspaceId: string | null;
  channelType: CommunicationChannelType;
}) {
  const now = new Date();
  const existingSession = await prisma.communicationSession.findFirst({
    where: {
      ownerId: input.ownerId,
      relationCaseId: input.relationCaseId,
      status: {
        in: ["REQUESTED", "PREPARED_NOT_STARTED"],
      },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existingSession) {
    const mergedChannelType = mergeMediaChannelType(existingSession.channelType, input.channelType);
    const usedScreenShare = existingSession.channelType === "SCREEN_SHARE" || input.channelType === "SCREEN_SHARE";

    return prisma.communicationSession.update({
      where: {
        id: existingSession.id,
      },
      data: {
        workspaceId: input.workspaceId,
        relationTemplateId: input.relationTemplateId,
        channelType: mergedChannelType,
        provider: existingSession.provider,
        status: "REQUESTED",
        title: titleForMediaSession(mergedChannelType, usedScreenShare),
        note: "V1 WebRTC navigateur : signalisation HTTP controlee, aucun token public, aucun email, aucune notification.",
        recordingEnabled: false,
        transcriptionRequested: false,
        transcriptionConsented: false,
        automaticNotificationSent: false,
        tokenGenerated: false,
        accessOpened: existingSession.accessOpened,
        workflowStarted: false,
        expiresAt: createRelationMediaSessionExpiresAt(now),
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
      provider: "NONE",
      status: "REQUESTED",
      title: channelTitles[input.channelType],
      purpose: "Session relationnelle distante preparee depuis le dossier.",
      note: "V1 WebRTC navigateur : signalisation HTTP controlee, aucun token public, aucun email, aucune notification.",
      transcriptionRequested: false,
      transcriptionConsented: false,
      recordingEnabled: false,
      automaticNotificationSent: false,
      tokenGenerated: false,
      accessOpened: false,
      workflowStarted: false,
      expiresAt: createRelationMediaSessionExpiresAt(now),
    },
  });
}

export async function getOrCreateLiveKitRelationMediaSession(input: {
  ownerId: string;
  relationCaseId: string;
  relationTemplateId: string | null;
  workspaceId: string | null;
}) {
  const now = new Date();
  const existingSession = await prisma.communicationSession.findFirst({
    where: {
      ownerId: input.ownerId,
      relationCaseId: input.relationCaseId,
      provider: "LIVEKIT_PENDING",
      status: { in: ["REQUESTED", "PREPARED_NOT_STARTED"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existingSession && !isRelationMediaSessionExpired(existingSession, now)) {
    return prisma.communicationSession.update({
      where: { id: existingSession.id },
      data: {
        workspaceId: input.workspaceId,
        relationTemplateId: input.relationTemplateId,
        tokenGenerated: true,
        expiresAt: existingSession.expiresAt ?? createRelationMediaSessionExpiresAt(now),
      },
    });
  }

  if (existingSession) await cancelExpiredRelationMediaSession(existingSession);

  return prisma.communicationSession.create({
    data: {
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      relationTemplateId: input.relationTemplateId,
      relationCaseId: input.relationCaseId,
      channelType: "VIDEO_IP",
      provider: "LIVEKIT_PENDING",
      status: "REQUESTED",
      title: "Communication relationnelle LiveKit",
      purpose: "Salle media gouvernee liee au dossier.",
      note: "Token court genere sur demande explicite. Aucun demarrage media, email, notification, enregistrement, transcription ou workflow.",
      expiresAt: createRelationMediaSessionExpiresAt(now),
      tokenGenerated: true,
      recordingEnabled: false,
      transcriptionRequested: false,
      transcriptionConsented: false,
      automaticNotificationSent: false,
      accessOpened: false,
      workflowStarted: false,
    },
  });
}

type LiveKitMediaUsage = "audio" | "video" | "screen";

const LIVEKIT_MEDIA_USAGE_MARKER = /\s*\[mediaUsed:([^\]]*)\]/;

function liveKitUsageFromNote(note: string | null) {
  const values = new Set(note?.match(LIVEKIT_MEDIA_USAGE_MARKER)?.[1]?.split(",") ?? []);
  return {
    audio: values.has("audio"),
    video: values.has("video"),
    screen: values.has("screen"),
  };
}

function liveKitUsageNote(note: string | null, usage: { audio: boolean; video: boolean; screen: boolean }) {
  const base = (note ?? "").replace(LIVEKIT_MEDIA_USAGE_MARKER, "").trim();
  const values = (["audio", "video", "screen"] as const).filter((key) => usage[key]);
  return `${base}${base ? " " : ""}[mediaUsed:${values.join(",")}]`;
}

function liveKitUsageTitle(usage: { audio: boolean; video: boolean; screen: boolean }) {
  if (usage.video && usage.screen) return "Visio et partage d'ecran";
  if (usage.audio && usage.screen) return "Audio et partage d'ecran";
  if (usage.screen) return "Partage d'ecran";
  if (usage.video) return "Visio";
  if (usage.audio) return "Audio";
  return "Communication securisee";
}

export async function markLiveKitSessionMediaUsage(input: {
  communicationSessionId: string;
  relationCaseId: string;
  usage: LiveKitMediaUsage;
}) {
  const session = await prisma.communicationSession.findFirst({
    where: {
      id: input.communicationSessionId,
      relationCaseId: input.relationCaseId,
      provider: "LIVEKIT_PENDING",
      status: { in: ["REQUESTED", "PREPARED_NOT_STARTED"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (!session) return null;

  const usage = liveKitUsageFromNote(session.note);
  usage[input.usage] = true;
  const channelType: CommunicationChannelType = usage.video
    ? "VIDEO_IP"
    : usage.screen
      ? "SCREEN_SHARE"
      : "VOICE_IP";

  return prisma.communicationSession.update({
    where: { id: session.id },
    data: { channelType, title: liveKitUsageTitle(usage), note: liveKitUsageNote(session.note, usage) },
  });
}
