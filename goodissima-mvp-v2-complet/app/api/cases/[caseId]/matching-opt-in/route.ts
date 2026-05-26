import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const body = await req.json();
    const matchingEnabled = typeof body.matchingEnabled === "boolean" ? body.matchingEnabled : null;

    if (matchingEnabled === null) {
      return NextResponse.json({ error: "matchingEnabled invalide" }, { status: 400 });
    }

    let relationCase: { id: string; matchingEnabled: boolean } | null = null;
    let actorType = "OWNER";
    let actorId: string | null = null;

    if (typeof body.candidateAccessToken === "string") {
      relationCase = await prisma.relationCase.findFirst({
        where: { ...activeCandidateAccessWhere(body.candidateAccessToken), id: params.caseId },
        select: { id: true, matchingEnabled: true },
      });
      actorType = "CANDIDATE";
      actorId = "CANDIDATE";
    } else {
      const owner = await getCurrentPrismaUser();
      relationCase = await prisma.relationCase.findFirst({
        where: { id: params.caseId, ownerId: owner.id },
        select: { id: true, matchingEnabled: true },
      });
      actorId = owner.id;
    }

    if (!relationCase) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    const updated = await prisma.relationCase.update({
      where: { id: relationCase.id },
      data: { matchingEnabled },
      select: { id: true, matchingEnabled: true },
    });

    if (matchingEnabled !== relationCase.matchingEnabled) {
      await createRelationEvent({
        caseId: relationCase.id,
        type: "MATCHING_OPT_IN_CHANGED",
        actorType,
        actorId,
        payload: { enabled: matchingEnabled },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[matching] Unable to update opt-in", error);
    return NextResponse.json({ error: "Impossible de modifier le matching" }, { status: 500 });
  }
}
