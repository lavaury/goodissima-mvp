import { NextResponse } from "next/server";
import { RelationStatus } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { createCandidateAccessExpiresAt, createCandidateAccessToken } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const candidateEmail =
    typeof body.candidateEmail === "string" ? body.candidateEmail.trim().toLowerCase() : "";
  const candidateName = typeof body.candidateName === "string" ? body.candidateName.trim() : "";
  const messageBody = typeof body.message === "string" ? body.message.trim() : "";

  if (!body.gLinkId || !candidateName || !candidateEmail || !messageBody) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const gLink = await prisma.gLink.findUnique({ where: { id: body.gLinkId } });

  if (!gLink) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const existingRelationCase = await prisma.relationCase.findFirst({
    where: {
      gLinkId: gLink.id,
      candidateEmail: { equals: candidateEmail, mode: "insensitive" },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      candidateAccessToken: true,
    },
  });

  if (existingRelationCase) {
    await prisma.message.create({
      data: {
        caseId: existingRelationCase.id,
        senderType: "CANDIDATE",
        senderEmail: candidateEmail,
        body: messageBody,
      },
    });

    if (body.documentName && body.documentUrl) {
      await prisma.document.create({
        data: {
          caseId: existingRelationCase.id,
          uploadedByEmail: candidateEmail,
          fileName: body.documentName,
          fileUrl: body.documentUrl,
          mimeType: "application/octet-stream",
        },
      });
    }

    await auditLog({
      caseId: existingRelationCase.id,
      actorEmail: candidateEmail,
      eventType: "MESSAGE_SENT",
      metadata: { existing: true },
    });

    if (body.documentName && body.documentUrl) {
      await auditLog({
        caseId: existingRelationCase.id,
        actorEmail: candidateEmail,
        eventType: "DOCUMENT_UPLOADED",
        metadata: { fileName: body.documentName },
      });
    }

    return NextResponse.json({ candidateAccessToken: existingRelationCase.candidateAccessToken });
  }

  const relationCase = await prisma.relationCase.create({
    data: {
      gLinkId: gLink.id,
      ownerId: gLink.ownerId,
      candidateAccessToken: createCandidateAccessToken(),
      candidateAccessExpiresAt: createCandidateAccessExpiresAt(),
      candidateName,
      candidateEmail,
      status: RelationStatus.NEW,
      messages: {
        create: {
          senderType: "CANDIDATE",
          senderEmail: candidateEmail,
          body: messageBody,
        },
      },
      documents:
        body.documentName && body.documentUrl
          ? {
              create: {
                uploadedByEmail: candidateEmail,
                fileName: body.documentName,
                fileUrl: body.documentUrl,
                mimeType: "application/octet-stream",
              },
            }
          : undefined,
    },
    select: {
      id: true,
      candidateAccessToken: true,
    },
  });

  await auditLog({
    caseId: relationCase.id,
    actorEmail: candidateEmail,
    eventType: "CASE_CREATED",
    metadata: { gLinkId: gLink.id },
  });
  await auditLog({
    caseId: relationCase.id,
    actorEmail: candidateEmail,
    eventType: "MESSAGE_SENT",
    metadata: { initial: true },
  });

  if (body.documentName && body.documentUrl) {
    await auditLog({
      caseId: relationCase.id,
      actorEmail: candidateEmail,
      eventType: "DOCUMENT_UPLOADED",
      metadata: { fileName: body.documentName },
    });
  }

  return NextResponse.json({ candidateAccessToken: relationCase.candidateAccessToken });
}
