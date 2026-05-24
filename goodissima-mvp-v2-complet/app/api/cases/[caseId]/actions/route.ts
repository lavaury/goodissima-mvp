import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { sendNewRelationActionEmail } from "@/lib/email";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { getRelationActionTypeLabel, isRelationActionType } from "@/lib/relation-actions";

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;

    if (!isRelationActionType(body.type)) {
      return NextResponse.json({ error: "type action invalide" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "titre action manquant" }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: {
        id: true,
        candidateAccessToken: true,
        candidateEmail: true,
        candidateEmailNotificationsEnabled: true,
        candidateName: true,
        gLink: { select: { title: true } },
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "dossier introuvable" }, { status: 404 });
    }

    const action = await prisma.relationAction.create({
      data: {
        relationCaseId: relationCase.id,
        type: body.type,
        title,
        description,
        createdByRole: "OWNER",
        payload: body.payload && typeof body.payload === "object" ? body.payload : undefined,
      },
    });

    await createRelationEvent({
      caseId: relationCase.id,
      type: "ACTION_CREATED",
      actorType: "OWNER",
      actorId: owner.id,
      payload: {
        actionId: action.id,
        actionType: action.type,
        title: action.title,
      },
    });

    if (relationCase.candidateEmailNotificationsEnabled) {
      await sendNewRelationActionEmail({
        candidateEmail: relationCase.candidateEmail,
        ownerEmail: owner.email,
        caseId: relationCase.id,
        caseTitle: relationCase.gLink.title,
        candidateName: relationCase.candidateName,
        candidateAccessToken: relationCase.candidateAccessToken,
        actionTitle: action.title,
        actionType: getRelationActionTypeLabel(action.type),
      });
    }

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Impossible de creer l'action" }, { status: 500 });
  }
}
