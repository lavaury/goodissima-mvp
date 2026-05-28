import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { RelationStatus } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  createCandidateAccessExpiresAt,
  createCandidateAccessToken,
} from "@/lib/candidate-access";
import { isGoodissimaDebugMode } from "@/lib/debug";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { linkId: string } }) {
  if (!isGoodissimaDebugMode()) {
    return NextResponse.json({ error: "Debug mode disabled" }, { status: 403 });
  }

  const owner = await getCurrentPrismaUser();
  const link = await prisma.gLink.findUnique({
    where: { id: params.linkId },
    select: {
      id: true,
      ownerId: true,
      title: true,
      templateId: true,
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (link.ownerId !== owner.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const relationCase = await prisma.relationCase.create({
    data: {
      gLinkId: link.id,
      ownerId: owner.id,
      templateId: link.templateId,
      candidateAccessToken: createCandidateAccessToken(),
      candidateAccessExpiresAt: createCandidateAccessExpiresAt(),
      candidateName: "Candidat test debug",
      candidateEmail: `debug+${now}@goodissima.local`,
      candidateEmailNotificationsEnabled: false,
      status: RelationStatus.NEW,
      messages: {
        create: {
          senderType: "CANDIDATE",
          senderEmail: `debug+${now}@goodissima.local`,
          body: "Conversation de test creee en mode debug.",
        },
      },
      auditLogs: {
        create: {
          actorEmail: owner.email,
          eventType: "DEBUG_TEST_CASE_CREATED",
          metadata: { linkId: link.id },
        },
      },
    },
    select: {
      id: true,
      candidateAccessToken: true,
    },
  });

  await createRelationEvent({
    caseId: relationCase.id,
    type: "MESSAGE_SENT",
    actorType: "CANDIDATE",
    actorId: "DEBUG",
    payload: { debug: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath(`/links/${link.id}`);
  revalidatePath(`/cases/${relationCase.id}`);

  return NextResponse.json({
    caseId: relationCase.id,
    candidateAccessToken: relationCase.candidateAccessToken,
  });
}
