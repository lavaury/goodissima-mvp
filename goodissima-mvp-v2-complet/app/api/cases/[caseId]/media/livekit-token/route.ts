import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getLiveKitConfigStatus } from "@/lib/media/livekit-config";
import { createLiveKitParticipantToken } from "@/lib/media/livekit-token-service";
import { prisma } from "@/lib/prisma";
import { getOrCreateLiveKitRelationMediaSession } from "@/lib/relation-media-sessions";

export async function POST(_req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: { id: true, workspaceId: true, templateId: true, gLink: { select: { workspaceId: true } } },
    });
    if (!relationCase) return NextResponse.json({ error: "Relation introuvable pour cet utilisateur." }, { status: 404 });
    if (!getLiveKitConfigStatus().configured) {
      return NextResponse.json({ error: "La salle securisee n'est pas disponible pour le moment." }, { status: 503 });
    }

    const workspaceId = relationCase.workspaceId ?? relationCase.gLink.workspaceId ?? null;
    const session = await getOrCreateLiveKitRelationMediaSession({
      ownerId: owner.id,
      relationCaseId: relationCase.id,
      relationTemplateId: relationCase.templateId,
      workspaceId,
    });
    const credentials = await createLiveKitParticipantToken({
      communicationSessionId: session.id,
      relationCaseId: relationCase.id,
      workspaceId: workspaceId ?? undefined,
      role: "owner",
      participantIdentity: `owner:${owner.id}`,
      participantName: owner.name ?? "Proprietaire",
    });
    return NextResponse.json({
      ...credentials,
      communicationSessionId: session.id,
      expiresAt: credentials.expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Impossible de creer l'acces a la salle securisee." }, { status: 500 });
  }
}
