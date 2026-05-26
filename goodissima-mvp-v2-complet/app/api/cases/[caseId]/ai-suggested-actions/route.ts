import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { cleanAISuggestedAction, mapAIActionToRelationActionType } from "@/lib/ai/actions";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const suggestedAction = cleanAISuggestedAction(body.action);

    if (!suggestedAction) {
      return NextResponse.json({ error: "Suggestion IA invalide" }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: { id: true },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    const relationActionType = mapAIActionToRelationActionType(suggestedAction.type);
    const relationAction = await prisma.relationAction.create({
      data: {
        relationCaseId: relationCase.id,
        type: relationActionType,
        title: suggestedAction.label,
        description: suggestedAction.reason,
        createdByRole: "OWNER",
        payload: {
          source: "AI_SUGGESTION",
          aiActionType: suggestedAction.type,
          futureReady: {
            confidence: null,
            dismissSuggestion: false,
            regenerateSuggestions: false,
          },
        },
      },
    });

    await createRelationEvent({
      caseId: relationCase.id,
      type: "AI_SUGGESTED_ACTION_ACCEPTED",
      actorType: "OWNER",
      actorId: owner.id,
      payload: {
        actionId: relationAction.id,
        aiActionType: suggestedAction.type,
        relationActionType,
        title: relationAction.title,
      },
    });

    await auditLog({
      caseId: relationCase.id,
      actorEmail: owner.email,
      eventType: "AI_SUGGESTED_ACTION_ACCEPTED",
      metadata: {
        actionId: relationAction.id,
        aiActionType: suggestedAction.type,
        relationActionType,
      },
    });

    await prisma.aIEvent.create({
      data: {
        caseId: relationCase.id,
        provider: "goodissima",
        model: "human-in-the-loop",
        action: "suggested_action",
        status: "success",
        promptVersion: "relation-summary-v2",
        outputSummary: suggestedAction.label,
      },
    });

    return NextResponse.json(relationAction, { status: 201 });
  } catch (error) {
    console.error("[ai] Unable to accept suggested action", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_ACTION_ERROR",
    });
    return NextResponse.json({ error: "Impossible de creer l'action suggeree" }, { status: 500 });
  }
}
