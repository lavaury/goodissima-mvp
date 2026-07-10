import { NextResponse } from "next/server";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { getLiveKitConfigStatus } from "@/lib/media/livekit-config";
import { createLiveKitParticipantToken } from "@/lib/media/livekit-token-service";
import { prisma } from "@/lib/prisma";
import { getOrCreateLiveKitRelationMediaSession } from "@/lib/relation-media-sessions";

function normalizeBody(value: unknown): { candidateAccessToken?: unknown } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const body = normalizeBody(await req.json().catch(() => ({})));
    const candidateAccessToken = typeof body.candidateAccessToken === "string" ? body.candidateAccessToken.trim() : "";
    if (!candidateAccessToken) return NextResponse.json({ error: "Acces candidat requis." }, { status: 400 });
    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ...activeCandidateAccessWhere(candidateAccessToken) },
      select: {
        id: true,
        ownerId: true,
        workspaceId: true,
        templateId: true,
        candidateName: true,
        gLink: { select: { workspaceId: true } },
      },
    });
    if (!relationCase) return NextResponse.json({ error: "Relation introuvable ou acces candidat invalide." }, { status: 404 });
    if (!getLiveKitConfigStatus().configured) {
      return NextResponse.json({ error: "Le service de communication LiveKit n'est pas configure." }, { status: 503 });
    }

    const workspaceId = relationCase.workspaceId ?? relationCase.gLink.workspaceId ?? null;
    const session = await getOrCreateLiveKitRelationMediaSession({
      ownerId: relationCase.ownerId,
      relationCaseId: relationCase.id,
      relationTemplateId: relationCase.templateId,
      workspaceId,
    });
    const credentials = await createLiveKitParticipantToken({
      communicationSessionId: session.id,
      relationCaseId: relationCase.id,
      workspaceId: workspaceId ?? undefined,
      role: "candidate",
      participantIdentity: `candidate:${relationCase.id}`,
      participantName: relationCase.candidateName || "Candidat",
    });
    return NextResponse.json({
      ...credentials,
      communicationSessionId: session.id,
      expiresAt: credentials.expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Impossible de creer l'acces LiveKit candidat." }, { status: 500 });
  }
}
