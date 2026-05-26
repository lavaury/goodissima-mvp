import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const draftType = typeof body.draftType === "string" ? body.draftType.slice(0, 80) : "UNKNOWN";

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: { id: true },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    await createRelationEvent({
      caseId: relationCase.id,
      type: "AI_DRAFT_USED",
      actorType: "OWNER",
      actorId: owner.id,
      payload: { draftType },
    });

    await prisma.aIEvent.create({
      data: {
        caseId: relationCase.id,
        provider: "goodissima",
        model: "human-in-the-loop",
        action: "draft_used",
        status: "success",
        promptVersion: "draft-assistant-v1",
        outputSummary: draftType,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ai] Unable to audit draft usage", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_DRAFT_USED_ERROR",
    });
    return NextResponse.json({ error: "Impossible d'auditer le brouillon" }, { status: 500 });
  }
}
