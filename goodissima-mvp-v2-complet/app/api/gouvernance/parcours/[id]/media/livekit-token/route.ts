import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getLiveKitConfigStatus } from "@/lib/media/livekit-config";
import { createLiveKitParticipantToken } from "@/lib/media/livekit-token-service";
import { prisma } from "@/lib/prisma";
import { createRelationMediaSessionExpiresAt, isRelationMediaSessionExpired, cancelExpiredRelationMediaSession } from "@/lib/relation-media-sessions";
import { resolveOwnedGovernedJourney } from "@/lib/governed-journey-authority";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const scope = await resolveOwnedGovernedJourney(prisma, { formTemplateId: params.id, authorityUserId: owner.id });
    if (!scope || scope.status === "CLOSED" || scope.status === "CANCELLED") return NextResponse.json({ error: "Parcours introuvable pour cet organisateur." }, { status: 404 });
    if (!getLiveKitConfigStatus().configured) return NextResponse.json({ error: "La salle sécurisée n'est pas disponible pour le moment." }, { status: 503 });

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const preferredSessionId = typeof body.preferredSessionId === "string" ? body.preferredSessionId : null;
    const preferred = preferredSessionId ? await prisma.communicationSession.findFirst({ where: { id: preferredSessionId, ownerId: owner.id, relationTemplateId: scope.relationTemplateId, relationCaseId: null, status: { in: ["REQUESTED", "PREPARED_NOT_STARTED"] } } }) : null;
    if (preferredSessionId && !preferred) return NextResponse.json({ error: "Cette réunion est terminée ou n'est plus disponible." }, { status: 409 });

    const current = preferred ?? await prisma.communicationSession.findFirst({ where: { ownerId: owner.id, relationTemplateId: scope.relationTemplateId, relationCaseId: null, provider: "LIVEKIT_PENDING", status: { in: ["REQUESTED", "PREPARED_NOT_STARTED"] } }, orderBy: { updatedAt: "desc" } });
    if (current && isRelationMediaSessionExpired(current)) await cancelExpiredRelationMediaSession(current);
    let session = current && !isRelationMediaSessionExpired(current) ? current : await prisma.communicationSession.create({ data: { ownerId: owner.id, workspaceId: scope.workspaceId, relationTemplateId: scope.relationTemplateId, relationCaseId: null, channelType: "VIDEO_IP", provider: "LIVEKIT_PENDING", status: "REQUESTED", title: "Communication sécurisée du parcours", purpose: "Salle sécurisée gouvernée liée au parcours.", note: "Ouverture explicite par l'organisateur. Aucun média, email, notification, enregistrement, transcription ou workflow automatique.", expiresAt: createRelationMediaSessionExpiresAt(), tokenGenerated: true, recordingEnabled: false, transcriptionRequested: false, transcriptionConsented: false, automaticNotificationSent: false, accessOpened: true, workflowStarted: false } });
    if (session.status === "PREPARED_NOT_STARTED" || session.provider !== "LIVEKIT_PENDING" || !session.accessOpened) session = await prisma.communicationSession.update({ where: { id: session.id }, data: { provider: "LIVEKIT_PENDING", status: "REQUESTED", accessOpened: true, tokenGenerated: true, expiresAt: createRelationMediaSessionExpiresAt() } });

    const credentials = await createLiveKitParticipantToken({ communicationSessionId: session.id, workspaceId: scope.workspaceId ?? undefined, role: "owner", participantIdentity: `owner:${owner.id}`, participantName: owner.name ?? "Organisateur", roleLabel: "Organisateur", accessKind: "Compte Goodissima" });
    return NextResponse.json({ livekitUrl: credentials.livekitUrl, roomName: credentials.roomName, token: credentials.token, expiresAt: credentials.expiresAt.toISOString(), communicationSessionId: session.id, displayName: owner.name ?? "Organisateur", role: "Organisateur" });
  } catch {
    return NextResponse.json({ error: "Impossible d'ouvrir la salle sécurisée du parcours." }, { status: 500 });
  }
}
