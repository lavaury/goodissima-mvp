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
import { canCandidateWriteInRelation, getRelationGovernanceBlockedMessage } from "@/lib/relation-governance";
import { evaluateTrustAdmission } from "@/lib/trust-admission";
import {
  evaluateRelationAdmissionPolicyV1,
  resolveAdmissionTrustPolicyForLink,
} from "@/lib/trust-policy";

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

function isTrustAdmissionDryRunEnabledForGLink(gLinkId: string) {
  if (process.env.TRUST_ADMISSION_CREDENTIALS_DRY_RUN !== "true") {
    return false;
  }

  const pilotGLinkIds = (process.env.TRUST_ADMISSION_PILOT_GLINK_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return pilotGLinkIds.includes(gLinkId);
}

function getCandidateIdentityIdFromBody(body: Record<string, unknown>) {
  return typeof body.candidateIdentityId === "string" && body.candidateIdentityId.trim()
    ? body.candidateIdentityId.trim()
    : null;
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
      governanceStatus: true,
      owner: { select: { email: true, notificationPreferences: true } },
      gLink: { select: { title: true } },
    },
  });

  if (existingRelationCase) {
    if (!canCandidateWriteInRelation(existingRelationCase.governanceStatus)) {
      return NextResponse.json(
        { error: getRelationGovernanceBlockedMessage(existingRelationCase.governanceStatus) },
        { status: 409 },
      );
    }

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
  const admissionTrustPolicy = await resolveAdmissionTrustPolicyForLink(prisma, {
    gLinkId: gLink.id,
    templateId: relationTemplate?.id,
  });
  const admissionEvaluation = evaluateRelationAdmissionPolicyV1({
    policy: admissionTrustPolicy.policy,
    candidateEmail,
    candidateConsentAccepted: false,
  });

  if (!admissionEvaluation.allowed) {
    console.warn("[trust-policy] Relation admission blocked", {
      route: "app/api/cases/route.ts",
      gLinkId: gLink.id,
      templateId: relationTemplate?.id ?? null,
      source: admissionTrustPolicy.source,
      reasons: admissionEvaluation.reasons,
      missingRequirements: admissionEvaluation.missingRequirements,
    });

    return NextResponse.json(
      {
        error: "Admission dans la relation bloquée par la Trust Policy.",
        reasons: admissionEvaluation.reasons,
        missingRequirements: admissionEvaluation.missingRequirements,
      },
      { status: 403 },
    );
  }

  if (
    admissionTrustPolicy.policy &&
    isTrustAdmissionDryRunEnabledForGLink(gLink.id)
  ) {
    const candidateIdentityId = getCandidateIdentityIdFromBody(body);

    try {
      const credentialAdmissionEvaluation = await evaluateTrustAdmission(prisma, {
        trustPolicyId: admissionTrustPolicy.policy.id,
        candidateIdentityId,
      });

      console.info("[trust-admission] Credential admission dry-run", {
        route: "app/api/cases/route.ts",
        gLinkId: gLink.id,
        trustPolicyId: admissionTrustPolicy.policy.id,
        candidateIdentityId,
        allowed: credentialAdmissionEvaluation.allowed,
        requiredCredentialTypes: credentialAdmissionEvaluation.requiredCredentialTypes,
        satisfiedCredentialTypes: credentialAdmissionEvaluation.satisfiedCredentialTypes,
        missingCredentialTypes: credentialAdmissionEvaluation.missingCredentialTypes,
        reasons: credentialAdmissionEvaluation.reasons,
        missingRequirements: credentialAdmissionEvaluation.missingRequirements,
      });
    } catch (error) {
      console.warn("[trust-admission] Credential admission dry-run failed", {
        route: "app/api/cases/route.ts",
        gLinkId: gLink.id,
        trustPolicyId: admissionTrustPolicy.policy.id,
        candidateIdentityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const relationCase = await prisma.$transaction(async (tx) => {
    const candidateIdentity = await tx.goodissimaIdentity.create({
      data: {
        type: "PERSON",
        status: "UNVERIFIED",
      },
    });

    const createdRelationCase = await tx.relationCase.create({
      data: {
        gLinkId: gLink.id,
        ownerId: gLink.ownerId,
        templateId: relationTemplate?.id,
        candidateIdentityId: candidateIdentity.id,
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

    console.info("[trust-identity] Candidate identity created for relation case", {
      relationCaseId: createdRelationCase.id,
      candidateIdentityId: candidateIdentity.id,
      identityCreated: true,
    });

    if (admissionTrustPolicy.policy && admissionTrustPolicy.source) {
      await tx.trustPolicy.create({
        data: {
          scope: "RELATION_CASE",
          relationCaseId: createdRelationCase.id,
          accessMode: admissionTrustPolicy.policy.accessMode,
          candidateCanRead: admissionTrustPolicy.policy.candidateCanRead,
          candidateCanWrite: admissionTrustPolicy.policy.candidateCanWrite,
          ownerCanRead: admissionTrustPolicy.policy.ownerCanRead,
          ownerCanWrite: admissionTrustPolicy.policy.ownerCanWrite,
          requireCandidateEmail: admissionTrustPolicy.policy.requireCandidateEmail,
          requireCandidateConsent: admissionTrustPolicy.policy.requireCandidateConsent,
          allowDocuments: admissionTrustPolicy.policy.allowDocuments,
          candidateTokenTtlDays: admissionTrustPolicy.policy.candidateTokenTtlDays,
          status: admissionTrustPolicy.policy.status,
          version: admissionTrustPolicy.policy.version,
          reason: `Snapshot admission ${admissionTrustPolicy.source}`,
        },
      });
    }

    return createdRelationCase;
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
