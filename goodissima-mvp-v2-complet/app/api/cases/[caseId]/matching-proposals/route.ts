import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const targetRelationId = typeof body.targetRelationId === "string" ? body.targetRelationId : "";

    if (!targetRelationId) {
      return NextResponse.json({ error: "Correspondance invalide" }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: { id: true },
    });
    const target = await prisma.relationCase.findFirst({
      where: { id: targetRelationId, ownerId: owner.id, matchingEnabled: true },
      select: { id: true },
    });

    if (!relationCase || !target) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    await createRelationEvent({
      caseId: relationCase.id,
      type: "MATCHING_PROPOSED",
      actorType: "OWNER",
      actorId: owner.id,
      payload: { targetRelationId: target.id, privacy: "identity_not_revealed" },
    });

    await prisma.aIEvent.create({
      data: {
        caseId: relationCase.id,
        provider: "goodissima",
        model: "human-in-the-loop",
        action: "matching_proposed",
        status: "success",
        promptVersion: "matching-v1",
        outputSummary: "Relation proposee sans revelation automatique d'identite",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[matching] Unable to propose", error);
    return NextResponse.json({ error: "Impossible de proposer la relation" }, { status: 500 });
  }
}
