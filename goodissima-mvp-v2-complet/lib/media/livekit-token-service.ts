import "server-only";

import { createHash } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { getLiveKitConfig } from "@/lib/media/livekit-config";

export type LiveKitParticipantRole = "owner" | "candidate" | "participant";

export type CreateLiveKitParticipantTokenInput = {
  communicationSessionId: string;
  relationCaseId?: string;
  workspaceId?: string;
  role: LiveKitParticipantRole;
  participantIdentity: string;
  participantName: string;
  ttlSeconds?: number;
};

export function createLiveKitRoomName(communicationSessionId: string) {
  const digest = createHash("sha256").update(communicationSessionId).digest("hex").slice(0, 24);
  return `goodissima-${digest}`;
}

export async function createLiveKitParticipantToken(input: CreateLiveKitParticipantTokenInput) {
  const { livekitUrl, apiKey, apiSecret } = getLiveKitConfig();
  const ttlSeconds = Math.min(3600, Math.max(60, input.ttlSeconds ?? 1800));
  const roomName = createLiveKitRoomName(input.communicationSessionId);
  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: input.participantIdentity,
    name: input.participantName,
    ttl: ttlSeconds,
    metadata: JSON.stringify({
      role: input.role,
      communicationSessionId: input.communicationSessionId,
      relationCaseId: input.relationCaseId,
      workspaceId: input.workspaceId,
    }),
  });
  accessToken.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  const token = await accessToken.toJwt();
  return { livekitUrl, roomName, token, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
}
