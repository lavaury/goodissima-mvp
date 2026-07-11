import { NextResponse } from "next/server";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { updateCommunicationAttendance } from "@/lib/communication-attendance";
import { prisma } from "@/lib/prisma";

const roleLabels = { EXPERT: "Expert", JUDGE: "Juge", THIRD_PARTY: "Tiers", ASSOCIATION: "Association", FAMILY: "Famille", OBSERVER: "Observateur", OTHER: "Participant invité" } as const;
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>; const sessionId = typeof body.communicationSessionId === "string" ? body.communicationSessionId : "";
  const event = body.event === "leave" ? "leave" : body.event === "join" ? "join" : body.event === "media" ? "media" : null;
  const media = body.media === "audio" || body.media === "video" || body.media === "screen" ? body.media : undefined;
  const invitation = await prisma.governedJourneyInvitation.findUnique({ where: { accessTokenHash: hashJourneyInvitationToken(params.id) } });
  if (!invitation || !sessionId || !event || invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.accessTokenExpiresAt <= new Date()) return NextResponse.json({ error: "Accès invité invalide." }, { status: 403 });
  const authorization = await prisma.governedMeetingParticipant.findFirst({ where: { communicationSessionId: sessionId, governedJourneyInvitationId: invitation.id, status: "AUTHORIZED", communicationSession: { ownerId: invitation.ownerId, relationTemplateId: invitation.relationTemplateId, relationCaseId: null, provider: "LIVEKIT_PENDING", status: "REQUESTED", accessOpened: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }, select: { id: true } });
  if (!authorization) return NextResponse.json({ error: "Session non autorisée." }, { status: 403 });
  const metadata = invitation.metadata && typeof invitation.metadata === "object" && !Array.isArray(invitation.metadata) ? invitation.metadata as Record<string, unknown> : {};
  const roleLabel = typeof metadata.participantRole === "string" && metadata.participantRole.trim() ? metadata.participantRole.trim() : roleLabels[invitation.role];
  await updateCommunicationAttendance({ sessionId, participantKey: `guest:${invitation.id}`, displayName: invitation.displayName, roleLabel, accessKind: "Invité gouverné", actorKind: "guest", event, media });
  return NextResponse.json({ updated: true });
}
