import { NextResponse } from "next/server";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { getLiveKitConfigStatus } from "@/lib/media/livekit-config";
import { createLiveKitParticipantToken } from "@/lib/media/livekit-token-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const invitation = await prisma.governedJourneyInvitation.findUnique({ where: { accessTokenHash: hashJourneyInvitationToken(params.id) } });
    if (!invitation || invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.accessTokenExpiresAt <= new Date()) return NextResponse.json({ error: "Accès invité inconnu, expiré ou révoqué." }, { status: 403 });
    if (!getLiveKitConfigStatus().configured) return NextResponse.json({ error: "La salle sécurisée n'est pas disponible pour le moment." }, { status: 503 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const communicationSessionId = typeof body.preferredSessionId === "string" ? body.preferredSessionId : "";
    const authorization = communicationSessionId ? await prisma.governedMeetingParticipant.findFirst({ where: { communicationSessionId, governedJourneyInvitationId: invitation.id, status: "AUTHORIZED", communicationSession: { ownerId: invitation.ownerId, relationTemplateId: invitation.relationTemplateId, relationCaseId: null, provider: "LIVEKIT_PENDING", status: "REQUESTED", accessOpened: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } } }) : null;
    if (!authorization) return NextResponse.json({ error: "Votre accès ne permet pas de rejoindre cette réunion." }, { status: 403 });
    const metadata = invitation.metadata && typeof invitation.metadata === "object" && !Array.isArray(invitation.metadata) ? invitation.metadata as Record<string, unknown> : {};
    const businessRole = typeof metadata.participantRole === "string" && metadata.participantRole.trim() ? metadata.participantRole.trim() : null;
    const roleLabels = { EXPERT: "Expert", JUDGE: "Juge", THIRD_PARTY: "Tiers", ASSOCIATION: "Association", FAMILY: "Famille", OBSERVER: "Observateur", OTHER: "Participant invité" } as const;
    const roleLabel = businessRole ?? roleLabels[invitation.role];
    const credentials = await createLiveKitParticipantToken({ communicationSessionId, workspaceId: invitation.workspaceId ?? undefined, role: "participant", participantIdentity: `guest:${invitation.id}`, participantName: invitation.displayName, roleLabel, accessKind: "Invité gouverné", ttlSeconds: 1800 });
    return NextResponse.json({ livekitUrl: credentials.livekitUrl, roomName: credentials.roomName, token: credentials.token, expiresAt: credentials.expiresAt.toISOString(), communicationSessionId, displayName: invitation.displayName, role: roleLabel });
  } catch { return NextResponse.json({ error: "Impossible de rejoindre la salle sécurisée." }, { status: 500 }); }
}
