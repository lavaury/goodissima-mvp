import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { CommunicationChannelType } from "@prisma/client";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import {
  markRelationMediaSessionStarted,
  relationMediaChannelTypes,
  serializeRelationMediaSession,
} from "@/lib/relation-media-sessions";

function normalizeBody(value: unknown): { candidateAccessToken?: unknown; sessionId?: unknown; channelType?: unknown } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const body = normalizeBody(await req.json().catch(() => ({})));
    const candidateAccessToken =
      typeof body.candidateAccessToken === "string" ? body.candidateAccessToken.trim() : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const channelType = typeof body.channelType === "string" ? body.channelType : "";

    if (!candidateAccessToken || !sessionId || !relationMediaChannelTypes.has(channelType as CommunicationChannelType)) {
      return NextResponse.json({ error: "Demarrage media candidat invalide." }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: {
        id: params.caseId,
        ...activeCandidateAccessWhere(candidateAccessToken),
      },
      select: {
        id: true,
        candidateAccessToken: true,
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Relation introuvable ou acces candidat invalide." }, { status: 404 });
    }

    const session = await markRelationMediaSessionStarted({
      sessionId,
      relationCaseId: relationCase.id,
      channelType: channelType as CommunicationChannelType,
    });

    if (!session) {
      return NextResponse.json({ error: "Session media introuvable ou non modifiable." }, { status: 404 });
    }

    revalidatePath(`/secure/${relationCase.candidateAccessToken}`);

    return NextResponse.json({ session: serializeRelationMediaSession(relationCase.id, session) });
  } catch (error) {
    console.error("[relation-media] candidate media-started failed", error);
    return NextResponse.json({ error: "Impossible de normaliser le demarrage media candidat." }, { status: 500 });
  }
}
