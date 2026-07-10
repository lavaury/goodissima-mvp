import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getLiveKitConfigStatus } from "@/lib/media/livekit-config";
import { createLiveKitParticipantToken } from "@/lib/media/livekit-token-service";
import { prisma } from "@/lib/prisma";
import { createRelationMediaSessionExpiresAt, isRelationMediaSessionExpired, cancelExpiredRelationMediaSession } from "@/lib/relation-media-sessions";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const form = await prisma.formTemplate.findFirst({ where: { id: params.id, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { relationTemplate: { select: { id: true, workspaceId: true } } } });
    if (!form?.relationTemplate) return NextResponse.json({ error: "Parcours introuvable pour cet organisateur." }, { status: 404 });
    if (!getLiveKitConfigStatus().configured) return NextResponse.json({ error: "La salle sécurisée n'est pas disponible pour le moment." }, { status: 503 });
    const current = await prisma.communicationSession.findFirst({ where: { ownerId: owner.id, relationTemplateId: form.relationTemplate.id, relationCaseId: null, provider: "LIVEKIT_PENDING", status: { in: ["REQUESTED", "PREPARED_NOT_STARTED"] } }, orderBy: { updatedAt: "desc" } });
    if (current && isRelationMediaSessionExpired(current)) await cancelExpiredRelationMediaSession(current);
    const session = current && !isRelationMediaSessionExpired(current) ? current : await prisma.communicationSession.create({ data: { ownerId: owner.id, workspaceId: form.relationTemplate.workspaceId, relationTemplateId: form.relationTemplate.id, relationCaseId: null, channelType: "VIDEO_IP", provider: "LIVEKIT_PENDING", status: "REQUESTED", title: "Communication sécurisée du parcours", purpose: "Salle sécurisée gouvernée liée au parcours.", note: "Ouverture explicite par l'organisateur. Aucun média, email, notification, enregistrement, transcription ou workflow automatique.", expiresAt: createRelationMediaSessionExpiresAt(), tokenGenerated: true, recordingEnabled: false, transcriptionRequested: false, transcriptionConsented: false, automaticNotificationSent: false, accessOpened: false, workflowStarted: false } });
    const credentials = await createLiveKitParticipantToken({ communicationSessionId: session.id, workspaceId: form.relationTemplate.workspaceId ?? undefined, role: "owner", participantIdentity: `owner:${owner.id}`, participantName: owner.name ?? "Organisateur", roleLabel: "Organisateur", accessKind: "Compte Goodissima" });
    return NextResponse.json({ livekitUrl: credentials.livekitUrl, roomName: credentials.roomName, token: credentials.token, expiresAt: credentials.expiresAt.toISOString(), communicationSessionId: session.id, displayName: owner.name ?? "Organisateur", role: "Organisateur" });
  } catch { return NextResponse.json({ error: "Impossible d'ouvrir la salle sécurisée du parcours." }, { status: 500 }); }
}
