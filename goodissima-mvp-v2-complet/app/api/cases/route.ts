import { NextResponse } from "next/server";
import { RelationStatus } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import {
  CANDIDATE_ACCESS_TTL_DAYS,
  createCandidateAccessExpiresAt,
  createCandidateAccessToken,
} from "@/lib/candidate-access";
import { createRelationEvent } from "@/lib/events";
import { createFormSubmission } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

const DEFAULT_RELATION_TEMPLATE_KEY = "DEFAULT_SECURE_CONVERSATION";

function getFormSubmissionData(body: Record<string, unknown>) {
  if (typeof body.formTemplateId !== "string" || !body.formTemplateId) {
    return null;
  }

  const answers = body.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return null;
  }

  return {
    formTemplateId: body.formTemplateId,
    answers: answers as Record<string, string>,
  };
}

function withCandidateCookie(token: string, gLinkId: string) {
  const response = NextResponse.json({ candidateAccessToken: token });
  response.cookies.set(`goodissima_candidate_${gLinkId}`, token, {
    httpOnly: true,
    maxAge: CANDIDATE_ACCESS_TTL_DAYS * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

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
    const message = await prisma.message.create({
      data: {
        caseId: existingRelationCase.id,
        senderType: "CANDIDATE",
        senderEmail: candidateEmail,
        body: messageBody,
      },
    });

    await createRelationEvent({
      caseId: existingRelationCase.id,
      type: "MESSAGE_SENT",
      actorType: "CANDIDATE",
      actorId: candidateEmail,
      payload: { existing: true, messageId: message.id },
    });

    if (body.documentName && body.documentUrl) {
      const document = await prisma.document.create({
        data: {
          caseId: existingRelationCase.id,
          uploadedByEmail: candidateEmail,
          fileName: body.documentName,
          fileUrl: body.documentUrl,
          mimeType: "application/octet-stream",
        },
      });

      await createRelationEvent({
        caseId: existingRelationCase.id,
        type: "DOCUMENT_UPLOADED",
        actorType: "CANDIDATE",
        actorId: candidateEmail,
        payload: { documentId: document.id, fileName: body.documentName },
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

    const formSubmission = getFormSubmissionData(body);
    if (formSubmission) {
      await createFormSubmission({
        formTemplateId: formSubmission.formTemplateId,
        caseId: existingRelationCase.id,
        answers: formSubmission.answers,
      });
    }

    return withCandidateCookie(existingRelationCase.candidateAccessToken, gLink.id);
  }

  const defaultRelationTemplate = await prisma.relationTemplate.findUnique({
    where: { key: DEFAULT_RELATION_TEMPLATE_KEY },
    select: { id: true },
  });

  const relationCase = await prisma.relationCase.create({
    data: {
      gLinkId: gLink.id,
      ownerId: gLink.ownerId,
      templateId: defaultRelationTemplate?.id,
      candidateAccessToken: createCandidateAccessToken(),
      candidateAccessExpiresAt: createCandidateAccessExpiresAt(),
      candidateName,
      candidateEmail,
      status: RelationStatus.NEW,
    },
    select: {
      id: true,
      candidateAccessToken: true,
    },
  });

  const message = await prisma.message.create({
    data: {
      caseId: relationCase.id,
      senderType: "CANDIDATE",
      senderEmail: candidateEmail,
      body: messageBody,
    },
  });

  const document =
    body.documentName && body.documentUrl
      ? await prisma.document.create({
          data: {
            caseId: relationCase.id,
            uploadedByEmail: candidateEmail,
            fileName: body.documentName,
            fileUrl: body.documentUrl,
            mimeType: "application/octet-stream",
          },
        })
      : null;

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
  await createRelationEvent({
    caseId: relationCase.id,
    type: "MESSAGE_SENT",
    actorType: "CANDIDATE",
    actorId: candidateEmail,
    payload: { initial: true, messageId: message.id },
  });

  if (document) {
    await auditLog({
      caseId: relationCase.id,
      actorEmail: candidateEmail,
      eventType: "DOCUMENT_UPLOADED",
      metadata: { fileName: body.documentName },
    });
    await createRelationEvent({
      caseId: relationCase.id,
      type: "DOCUMENT_UPLOADED",
      actorType: "CANDIDATE",
      actorId: candidateEmail,
      payload: { documentId: document.id, fileName: body.documentName },
    });
  }

  const formSubmission = getFormSubmissionData(body);
  if (formSubmission) {
    await createFormSubmission({
      formTemplateId: formSubmission.formTemplateId,
      caseId: relationCase.id,
      answers: formSubmission.answers,
    });
  }

  return withCandidateCookie(relationCase.candidateAccessToken, gLink.id);
}
