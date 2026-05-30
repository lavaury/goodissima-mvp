import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { sendRelationActionCompletedEmail } from "@/lib/email";
import { createRelationEvent } from "@/lib/events";
import { isNotificationEnabled, logNotificationSkipped } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";
import { getRelationActionTypeLabel } from "@/lib/relation-actions";

export async function PATCH(
  req: Request,
  { params }: { params: { caseId: string; actionId: string } },
) {
  try {
    const body = await req.json();
    const candidateAccessToken =
      typeof body.candidateAccessToken === "string" && body.candidateAccessToken.trim()
        ? body.candidateAccessToken.trim()
        : null;
    const owner = candidateAccessToken ? null : await getCurrentPrismaUser();

    if (body.status !== "COMPLETED") {
      return NextResponse.json({ error: "status action invalide" }, { status: 400 });
    }

    if (candidateAccessToken) {
      const relationCase = await prisma.relationCase.findFirst({
        where: { id: params.caseId, ...activeCandidateAccessWhere(candidateAccessToken) },
        select: { id: true },
      });

      if (!relationCase) {
        return NextResponse.json({ error: "acces candidat invalide" }, { status: 404 });
      }
    }

    const action = await prisma.relationAction.findFirst({
      where: {
        id: params.actionId,
        relationCaseId: params.caseId,
        relationCase: owner ? { ownerId: owner.id } : undefined,
      },
      select: {
        id: true,
        relationCaseId: true,
        type: true,
        title: true,
        status: true,
        relationCase: {
          select: {
            id: true,
            candidateEmail: true,
            candidateName: true,
            gLink: { select: { title: true } },
            owner: { select: { email: true, notificationPreferences: true } },
          },
        },
      },
    });

    if (!action) {
      return NextResponse.json({ error: "action introuvable" }, { status: 404 });
    }

    if (action.status === "COMPLETED") {
      return NextResponse.json({ ok: true });
    }

    const updated = await prisma.relationAction.update({
      where: { id: action.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await createRelationEvent({
      caseId: action.relationCaseId,
      type: "ACTION_COMPLETED",
      actorType: owner ? "OWNER" : "CANDIDATE",
      actorId: owner?.id,
      payload: {
        actionId: action.id,
        actionType: action.type,
        title: action.title,
      },
    });

    if (candidateAccessToken) {
      if (isNotificationEnabled(action.relationCase.owner.notificationPreferences, "validations")) {
        await sendRelationActionCompletedEmail({
          ownerEmail: action.relationCase.owner.email,
          candidateEmail: action.relationCase.candidateEmail,
          caseId: action.relationCase.id,
          caseTitle: action.relationCase.gLink.title,
          candidateName: action.relationCase.candidateName,
          actionTitle: action.title,
          actionType: getRelationActionTypeLabel(action.type),
        });
      } else {
        logNotificationSkipped(action.relationCase.owner.notificationPreferences, "validations", {
          caseId: action.relationCase.id,
          event: "candidate_action_completed",
          actionId: action.id,
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Impossible de completer l'action" }, { status: 500 });
  }
}
