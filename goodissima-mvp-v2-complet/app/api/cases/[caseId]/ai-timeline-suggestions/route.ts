import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { cleanAITimelineAction, mapAITimelineActionToRelationActionType } from "@/lib/ai/actions";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { canWriteInRelation, getRelationGovernanceBlockedMessage } from "@/lib/relation-governance";

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const suggestion = cleanAITimelineAction(body.action);

    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion timeline IA invalide" }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: { id: true, governanceStatus: true },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    if (!canWriteInRelation(relationCase.governanceStatus)) {
      return NextResponse.json(
        { error: getRelationGovernanceBlockedMessage(relationCase.governanceStatus) },
        { status: 409 },
      );
    }

    const relationActionType = mapAITimelineActionToRelationActionType(suggestion.type);
    const relationAction = await prisma.relationAction.create({
      data: {
        relationCaseId: relationCase.id,
        type: relationActionType,
        title: suggestion.label,
        description: suggestion.reason,
        createdByRole: "OWNER",
        payload: {
          source: "AI_TIMELINE_SUGGESTION",
          aiActionType: suggestion.type,
        },
      },
    });

    await createRelationEvent({
      caseId: relationCase.id,
      type: "AI_TIMELINE_SUGGESTION_ACCEPTED",
      actorType: "OWNER",
      actorId: owner.id,
      payload: {
        actionId: relationAction.id,
        aiActionType: suggestion.type,
        relationActionType,
        title: relationAction.title,
      },
    });

    await prisma.aIEvent.create({
      data: {
        caseId: relationCase.id,
        provider: "goodissima",
        model: "human-in-the-loop",
        action: "timeline_suggestion_accepted",
        status: "success",
        promptVersion: "timeline-intelligence-v1",
        outputSummary: suggestion.label,
      },
    });

    return NextResponse.json(relationAction, { status: 201 });
  } catch (error) {
    console.error("[ai] Unable to accept timeline suggestion", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_TIMELINE_ACCEPT_ERROR",
    });
    return NextResponse.json({ error: "Impossible de creer l'action timeline suggeree" }, { status: 500 });
  }
}
