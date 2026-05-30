import { NextResponse } from "next/server";
import { RelationStatus } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import {
  CANDIDATE_ACCESS_TTL_DAYS,
  createCandidateAccessExpiresAt,
  createCandidateAccessToken,
} from "@/lib/candidate-access";
import { sendNewDocumentEmail, sendNewMessageEmail, sendNewRelationCaseEmail } from "@/lib/email";
import { createRelationEvent } from "@/lib/events";
import { createFormSubmission } from "@/lib/forms";
import { isNotificationEnabled, logNotificationSkipped } from "@/lib/privacy";
import { getRelationTemplateForLink } from "@/lib/relation-templates";
import { prisma } from "@/lib/prisma";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const privateAnswerKeys = new Set(["notificationEmail"]);

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
    answers: Object.fromEntries(
      Object.entries(answers as Record<string, unknown>).filter(([key]) => !privateAnswerKeys.has(key)),
    ) as Record<string, string>,
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
  const submittedCandidateEmail =
    typeof body.candidateEmail === "string" ? body.candidateEmail.trim().toLowerCase() : "";
  const candidateNotificationEmail =
    typeof body.candidateNotificationEmail === "string"
      ? body.candidateNotificationEmail.trim().toLowerCase()
      : "";
  const wantsCandidateNotifications = body.emailNotificationsConsent === true;
  const candidateEmail = wantsCandidateNotifications ? candidateNotificationEmail : submittedCandidateEmail;
  const candidateName = typeof body.candidateName === "string" ? body.candidateName.trim() : "";
  const messageBody = typeof body.message === "string" ? body.message.trim() : "";

  if (wantsCandidateNotifications && (!candidateNotificationEmail || !emailPattern.test(candidateNotificationEmail))) {
    return NextResponse.json({ error: "Valid notification email required" }, { status: 400 });
  }

  if (!body.gLinkId || !candidateName || !candidateEmail || !messageBody) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const gLink = await prisma.gLink.findUnique({
    where: { id: body.gLinkId },
    include: { owner: { select: { email: true, notificationPreferences: true } } },
  });

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
      candidateName: true,
      candidateEmailNotificationsEnabled: true,
      owner: { select: { email: true, notificationPreferences: true } },
      gLink: { select: { title: true } },
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
      actorId: "CANDIDATE",
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
        actorId: "CANDIDATE",
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

    if (isNotificationEnabled(existingRelationCase.owner.notificationPreferences, "messages")) {
      await sendNewMessageEmail({
        ownerEmail: existingRelationCase.owner.email,
        candidateEmail,
        caseId: existingRelationCase.id,
        caseTitle: existingRelationCase.gLink.title,
        candidateName: existingRelationCase.candidateName,
        messageBody,
      });
    } else {
      logNotificationSkipped(existingRelationCase.owner.notificationPreferences, "messages", {
        caseId: existingRelationCase.id,
        event: "candidate_message_existing_case",
      });
    }

    if (body.documentName && body.documentUrl && isNotificationEnabled(existingRelationCase.owner.notificationPreferences, "documents")) {
      await sendNewDocumentEmail({
        ownerEmail: existingRelationCase.owner.email,
        candidateEmail,
        caseId: existingRelationCase.id,
        caseTitle: existingRelationCase.gLink.title,
        candidateName: existingRelationCase.candidateName,
        fileName: String(body.documentName),
      });
    } else if (body.documentName && body.documentUrl) {
      logNotificationSkipped(existingRelationCase.owner.notificationPreferences, "documents", {
        caseId: existingRelationCase.id,
        event: "candidate_document_existing_case",
      });
    }

    return withCandidateCookie(existingRelationCase.candidateAccessToken, gLink.id);
  }

  const relationTemplate = await getRelationTemplateForLink(gLink.templateId);

  const relationCase = await prisma.relationCase.create({
    data: {
      gLinkId: gLink.id,
      ownerId: gLink.ownerId,
      templateId: relationTemplate?.id,
      candidateAccessToken: createCandidateAccessToken(),
      candidateAccessExpiresAt: createCandidateAccessExpiresAt(),
      candidateName,
      candidateEmail,
      candidateEmailNotificationsEnabled: wantsCandidateNotifications,
      status: RelationStatus.NEW,
    },
    select: {
      id: true,
      candidateAccessToken: true,
      candidateName: true,
      candidateEmailNotificationsEnabled: true,
      owner: { select: { email: true, notificationPreferences: true } },
      gLink: { select: { title: true } },
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
    actorId: "CANDIDATE",
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
      actorId: "CANDIDATE",
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

  if (isNotificationEnabled(relationCase.owner.notificationPreferences, "requests")) {
    await sendNewRelationCaseEmail({
      ownerEmail: relationCase.owner.email,
      candidateEmail,
      caseId: relationCase.id,
      caseTitle: relationCase.gLink.title,
      candidateName: relationCase.candidateName,
      messageBody,
    });
  } else {
    logNotificationSkipped(relationCase.owner.notificationPreferences, "requests", {
      caseId: relationCase.id,
      event: "candidate_case_created",
    });
  }

  if (document && isNotificationEnabled(relationCase.owner.notificationPreferences, "documents")) {
    await sendNewDocumentEmail({
      ownerEmail: relationCase.owner.email,
      candidateEmail,
      caseId: relationCase.id,
      caseTitle: relationCase.gLink.title,
      candidateName: relationCase.candidateName,
      fileName: document.fileName,
    });
  } else if (document) {
    logNotificationSkipped(relationCase.owner.notificationPreferences, "documents", {
      caseId: relationCase.id,
      event: "candidate_document_new_case",
    });
  }

  return withCandidateCookie(relationCase.candidateAccessToken, gLink.id);
}
