import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { createRelationEvent } from "@/lib/events";
import { enqueueEmbeddingJob } from "@/lib/ai/embedding-jobs";
import { prisma } from "@/lib/prisma";
import { canCandidateWriteInRelation, getRelationGovernanceBlockedMessage } from "@/lib/relation-governance";

export async function PATCH(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const body = await req.json();
    const matchingEnabled = typeof body.matchingEnabled === "boolean" ? body.matchingEnabled : null;

    if (matchingEnabled === null) {
      return NextResponse.json({ error: "matchingEnabled invalide" }, { status: 400 });
    }

    let relationCase: { id: string; matchingEnabled: boolean; governanceStatus: string } | null = null;
    let actorType = "OWNER";
    let actorId: string | null = null;

    if (typeof body.candidateAccessToken === "string") {
      relationCase = await prisma.relationCase.findFirst({
        where: { ...activeCandidateAccessWhere(body.candidateAccessToken), id: params.caseId },
        select: { id: true, matchingEnabled: true, governanceStatus: true },
      });
      actorType = "CANDIDATE";
      actorId = "CANDIDATE";
    } else {
      const owner = await getCurrentPrismaUser();
      relationCase = await prisma.relationCase.findFirst({
        where: { id: params.caseId, ownerId: owner.id },
        select: { id: true, matchingEnabled: true, governanceStatus: true },
      });
      actorId = owner.id;
    }

    if (!relationCase) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    if (actorType === "CANDIDATE" && !canCandidateWriteInRelation(relationCase.governanceStatus)) {
      return NextResponse.json(
        { error: getRelationGovernanceBlockedMessage(relationCase.governanceStatus) },
        { status: 409 },
      );
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
      await enqueueEmbeddingJob({ relationCaseId: relationCase.id, triggerType: "manual_refresh" });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[matching] Unable to update opt-in", error);
    return NextResponse.json({ error: "Impossible de modifier le matching" }, { status: 500 });
  }
}
