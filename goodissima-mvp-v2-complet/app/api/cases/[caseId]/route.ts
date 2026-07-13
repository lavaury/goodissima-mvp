import { NextResponse } from "next/server";
import { RelationGovernanceStatus, RelationPriority, RelationStatus } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { sendRelationStatusEmail } from "@/lib/email";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { isRelationGovernanceStatus } from "@/lib/relation-governance";

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
    const data: {
      priority?: RelationPriority;
      status?: RelationStatus;
      matchingEnabled?: boolean;
      governanceStatus?: RelationGovernanceStatus;
      governanceUpdatedAt?: Date;
      governanceReason?: string | null;
      closedAt?: Date | null;
    } = {};

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

    if (body.matchingEnabled !== undefined) {
      if (typeof body.matchingEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid matchingEnabled" }, { status: 400 });
      }

      data.matchingEnabled = body.matchingEnabled;
    }

    if (body.governanceStatus !== undefined) {
      if (!isRelationGovernanceStatus(body.governanceStatus)) {
        return NextResponse.json({ error: "Invalid governanceStatus" }, { status: 400 });
      }

      data.governanceStatus = body.governanceStatus;
      data.governanceUpdatedAt = new Date();
      data.governanceReason =
        typeof body.governanceReason === "string" && body.governanceReason.trim()
          ? body.governanceReason.trim().slice(0, 500)
          : null;
      data.closedAt = body.governanceStatus === RelationGovernanceStatus.CLOSED ? new Date() : null;
    }

    if (!data.priority && !data.status && data.matchingEnabled === undefined && !data.governanceStatus) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: {
        id: true,
        candidateAccessToken: true,
        candidateAccessExpiresAt: true,
        candidateAccessRevokedAt: true,
        candidateEmail: true,
        candidateEmailNotificationsEnabled: true,
        candidateName: true,
        priority: true,
        status: true,
        governanceStatus: true,
        governanceReason: true,
        matchingEnabled: true,
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
        governanceStatus: true,
        governanceUpdatedAt: true,
        governanceReason: true,
        matchingEnabled: true,
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

      const candidateAccessIsActive =
        !relationCase.candidateAccessRevokedAt &&
        (!relationCase.candidateAccessExpiresAt || relationCase.candidateAccessExpiresAt > new Date());
      if (notifiedStatuses.has(data.status) && relationCase.candidateEmailNotificationsEnabled && candidateAccessIsActive) {
        console.info("[candidate-email] Relation status email trigger", {
          caseId: relationCase.id,
          status: data.status,
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

    if (data.governanceStatus && data.governanceStatus !== relationCase.governanceStatus) {
      await createRelationEvent({
        caseId: relationCase.id,
        type: "GOVERNANCE_STATUS_CHANGED",
        actorType: "OWNER",
        actorId: owner.id,
        payload: {
          from: relationCase.governanceStatus,
          to: data.governanceStatus,
          reason: data.governanceReason,
        },
      });

      await auditLog({
        caseId: relationCase.id,
        actorEmail: owner.email,
        eventType: "GOVERNANCE_STATUS_CHANGED",
        metadata: {
          from: relationCase.governanceStatus,
          to: data.governanceStatus,
          reason: data.governanceReason,
        },
      });
    }

    if (data.matchingEnabled !== undefined && data.matchingEnabled !== relationCase.matchingEnabled) {
      await createRelationEvent({
        caseId: relationCase.id,
        type: "MATCHING_OPT_IN_CHANGED",
        actorType: "OWNER",
        actorId: owner.id,
        payload: { enabled: data.matchingEnabled },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to update case" }, { status: 500 });
  }
}
