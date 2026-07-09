import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { CommunicationChannelType } from "@prisma/client";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateRelationMediaSession,
  relationMediaChannelTypes,
  serializeRelationMediaSession,
} from "@/lib/relation-media-sessions";

function normalizeBody(value: unknown): { candidateAccessToken?: unknown; channelType?: unknown } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const body = normalizeBody(await req.json().catch(() => ({})));
    const candidateAccessToken =
      typeof body.candidateAccessToken === "string" ? body.candidateAccessToken.trim() : "";
    const channelType = typeof body.channelType === "string" ? body.channelType : "VIDEO_IP";

    if (!candidateAccessToken) {
      return NextResponse.json({ error: "Acces candidat requis." }, { status: 400 });
    }

    if (!relationMediaChannelTypes.has(channelType as CommunicationChannelType)) {
      return NextResponse.json({ error: "Type de communication invalide." }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: {
        id: params.caseId,
        ...activeCandidateAccessWhere(candidateAccessToken),
      },
      select: {
        id: true,
        ownerId: true,
        workspaceId: true,
        templateId: true,
        candidateAccessToken: true,
        gLink: {
          select: {
            workspaceId: true,
          },
        },
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Relation introuvable ou acces candidat invalide." }, { status: 404 });
    }

    const workspaceId = relationCase.workspaceId ?? relationCase.gLink?.workspaceId ?? null;
    const session = await getOrCreateRelationMediaSession({
      ownerId: relationCase.ownerId,
      relationCaseId: relationCase.id,
      relationTemplateId: relationCase.templateId,
      workspaceId,
      channelType: channelType as CommunicationChannelType,
    });

    revalidatePath(`/secure/${relationCase.candidateAccessToken}`);

    return NextResponse.json({
      session: serializeRelationMediaSession(relationCase.id, session),
      signaling: {
        peerId: `candidate:${relationCase.id}`,
        role: "CANDIDATE",
      },
    });
  } catch (error) {
    console.error("[relation-media] candidate protected-call failed", error);
    return NextResponse.json({ error: "Impossible de preparer la communication candidat." }, { status: 500 });
  }
}
