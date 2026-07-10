import { NextResponse } from "next/server";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { getLiveKitConfigStatus } from "@/lib/media/livekit-config";
import { createLiveKitParticipantToken } from "@/lib/media/livekit-token-service";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const invitation = await prisma.governedJourneyInvitation.findUnique({ where: { accessTokenHash: hashJourneyInvitationToken(params.id) } });
    if (!invitation || invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.accessTokenExpiresAt <= new Date()) return NextResponse.json({ error: "Accès invité inconnu, expiré ou révoqué." }, { status: 403 });
    if (!getLiveKitConfigStatus().configured) return NextResponse.json({ error: "La salle sécurisée n'est pas disponible pour le moment." }, { status: 503 });
    const session = await prisma.communicationSession.findFirst({ where: { ownerId: invitation.ownerId, relationTemplateId: invitation.relationTemplateId, relationCaseId: null, provider: "LIVEKIT_PENDING", status: { in: ["REQUESTED", "PREPARED_NOT_STARTED"] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { updatedAt: "desc" } });
    if (!session) return NextResponse.json({ error: "La salle sécurisée n’est pas encore ouverte par l’organisateur." }, { status: 409 });
    const metadata = invitation.metadata && typeof invitation.metadata === "object" && !Array.isArray(invitation.metadata) ? invitation.metadata as Record<string, unknown> : {};
    const businessRole = typeof metadata.participantRole === "string" && metadata.participantRole.trim() ? metadata.participantRole.trim() : null;
    const roleLabels = { EXPERT: "Expert", JUDGE: "Juge", THIRD_PARTY: "Tiers", ASSOCIATION: "Association", FAMILY: "Famille", OBSERVER: "Observateur", OTHER: "Participant invité" } as const;
    const roleLabel = businessRole ?? roleLabels[invitation.role];
    const credentials = await createLiveKitParticipantToken({ communicationSessionId: session.id, workspaceId: invitation.workspaceId ?? undefined, role: "participant", participantIdentity: `guest:${invitation.id}`, participantName: invitation.displayName, roleLabel, accessKind: "Invité gouverné", ttlSeconds: 1800 });
    return NextResponse.json({ livekitUrl: credentials.livekitUrl, roomName: credentials.roomName, token: credentials.token, expiresAt: credentials.expiresAt.toISOString(), communicationSessionId: session.id, displayName: invitation.displayName, role: roleLabel });
  } catch { return NextResponse.json({ error: "Impossible de rejoindre la salle sécurisée." }, { status: 500 }); }
}
