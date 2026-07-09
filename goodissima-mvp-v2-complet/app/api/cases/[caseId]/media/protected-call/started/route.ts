import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { CommunicationChannelType } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  markRelationMediaSessionStarted,
  relationMediaChannelTypes,
  serializeRelationMediaSession,
} from "@/lib/relation-media-sessions";

function normalizeBody(value: unknown): { sessionId?: unknown; channelType?: unknown } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = normalizeBody(await req.json().catch(() => ({})));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const channelType = typeof body.channelType === "string" ? body.channelType : "";

    if (!sessionId || !relationMediaChannelTypes.has(channelType as CommunicationChannelType)) {
      return NextResponse.json({ error: "Demarrage media invalide." }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: {
        id: params.caseId,
        ownerId: owner.id,
      },
      select: {
        id: true,
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Relation introuvable pour cet utilisateur." }, { status: 404 });
    }

    const session = await markRelationMediaSessionStarted({
      sessionId,
      relationCaseId: relationCase.id,
      channelType: channelType as CommunicationChannelType,
    });

    if (!session) {
      return NextResponse.json({ error: "Session media introuvable ou non modifiable." }, { status: 404 });
    }

    revalidatePath(`/cases/${params.caseId}`);
    revalidatePath("/gouvernance");

    return NextResponse.json({ session: serializeRelationMediaSession(relationCase.id, session) });
  } catch (error) {
    console.error("[relation-media] owner media-started failed", error);
    return NextResponse.json({ error: "Impossible de normaliser le demarrage media." }, { status: 500 });
  }
}
