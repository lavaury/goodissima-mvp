import { NextResponse } from "next/server";
import { RelationPriority, RelationStatus } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { sendRelationStatusEmail } from "@/lib/email";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

const relationPriorities = new Set<string>(Object.values(RelationPriority));
const relationStatuses = new Set<string>(Object.values(RelationStatus));
const notifiedStatuses = new Set<RelationStatus>([RelationStatus.VALIDATED, RelationStatus.REJECTED]);

function getStatusEmailLabel(status: RelationStatus) {
  switch (status) {
    case RelationStatus.VALIDATED:
      return "Relation validee";
    case RelationStatus.REJECTED:
      return "Relation refusee";
    default:
      return status;
  }
}

export async function PATCH(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const data: { priority?: RelationPriority; status?: RelationStatus } = {};

    if (body.priority !== undefined) {
      if (typeof body.priority !== "string" || !relationPriorities.has(body.priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }

      data.priority = body.priority as RelationPriority;
    }

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !relationStatuses.has(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      data.status = body.status as RelationStatus;
    }

    if (!data.priority && !data.status) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: {
        id: true,
        candidateAccessToken: true,
        candidateEmail: true,
        candidateName: true,
        priority: true,
        status: true,
        gLink: { select: { title: true } },
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const updated = await prisma.relationCase.update({
      where: { id: relationCase.id },
      data,
      select: {
        id: true,
        priority: true,
        status: true,
      },
    });

    if (data.priority && data.priority !== relationCase.priority) {
      await createRelationEvent({
        caseId: relationCase.id,
        type: "PRIORITY_CHANGED",
        actorType: "OWNER",
        actorId: owner.id,
        payload: { from: relationCase.priority, to: data.priority },
      });
    }

    if (data.status && data.status !== relationCase.status) {
      const eventType =
        data.status === RelationStatus.ARCHIVED
          ? "CASE_ARCHIVED"
          : relationCase.status === RelationStatus.ARCHIVED
            ? "CASE_RESTORED"
            : "STATUS_CHANGED";

      await createRelationEvent({
        caseId: relationCase.id,
        type: eventType,
        actorType: "OWNER",
        actorId: owner.id,
        payload: { from: relationCase.status, to: data.status },
      });

      if (notifiedStatuses.has(data.status)) {
        console.info("[candidate-email] Relation status email trigger", {
          caseId: relationCase.id,
          to: relationCase.candidateEmail,
          status: data.status,
          secureLink: `/secure/${relationCase.candidateAccessToken}`,
          hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
        });

        await sendRelationStatusEmail({
          candidateEmail: relationCase.candidateEmail,
          ownerEmail: owner.email,
          caseId: relationCase.id,
          caseTitle: relationCase.gLink.title,
          candidateName: relationCase.candidateName,
          candidateAccessToken: relationCase.candidateAccessToken,
          statusLabel: getStatusEmailLabel(data.status),
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to update case" }, { status: 500 });
  }
}
