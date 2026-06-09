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
import { markTrustAdmissionTokenUsed, resolveTrustAdmissionToken } from "@/lib/trust-admission-tokens";
import { issueCandidateCreatedCredentialInTransaction } from "@/lib/trust-credentials";
import {
  evaluateRelationAdmissionPolicyV1,
  resolveAdmissionTrustPolicyForLink,
} from "@/lib/trust-policy";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const privateAnswerKeys = new Set(["notificationEmail"]);
type TrustAdmissionMode = "OBSERVE" | "SIMULATE_BLOCK" | "ENFORCE";
type ResolvedTrustAdmissionToken = { identityId: string; tokenId: string } | null;
type BadRequestCode =
  | "INVALID_REQUEST_BODY"
  | "INVALID_NOTIFICATION_EMAIL"
  | "REQUIRED_FIELD_MISSING"
  | "GLINK_NOT_FOUND";

function warnBadRequest({
  code,
  gLinkId,
  slug,
  reasons,
}: {
  code: BadRequestCode;
  gLinkId?: unknown;
  slug?: string | null;
  reasons: string[];
}) {
  console.warn("[api/cases] Bad request", {
    code,
    route: "app/api/cases/route.ts",
    gLinkId: typeof gLinkId === "string" ? gLinkId : null,
    slug: slug ?? null,
    reasons,
  });
}

function badRequest({
  code,
  error,
  gLinkId,
  slug,
  reasons,
}: {
  code: BadRequestCode;
  error: string;
  gLinkId?: unknown;
  slug?: string | null;
  reasons: string[];
}) {
  warnBadRequest({ code, gLinkId, slug, reasons });

  return NextResponse.json({ error, code, reasons }, { status: 400 });
}

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

function getTrustAdmissionModeForGLink(gLinkId: string): TrustAdmissionMode | null {
  const pilotGLinkIds = (process.env.TRUST_ADMISSION_PILOT_GLINK_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!pilotGLinkIds.includes(gLinkId)) {
    return null;
  }

  const configuredMode = process.env.TRUST_ADMISSION_MODE;

  if (
    configuredMode === "OBSERVE" ||
    configuredMode === "SIMULATE_BLOCK" ||
    configuredMode === "ENFORCE"
  ) {
    return configuredMode;
  }

  if (!configuredMode && process.env.TRUST_ADMISSION_CREDENTIALS_DRY_RUN === "true") {
    return "OBSERVE";
  }

  return null;
}

function getTrustAdmissionTokenFromBody(body: Record<string, unknown>) {
  return typeof body.trustAdmissionToken === "string" && body.trustAdmissionToken.trim()
    ? body.trustAdmissionToken.trim()
    : null;
}

async function observeTrustAdmissionToken(
  body: Record<string, unknown>,
  gLinkId: string,
): Promise<ResolvedTrustAdmissionToken> {
  const trustAdmissionToken = getTrustAdmissionTokenFromBody(body);

  if (!trustAdmissionToken) return null;

  const resolution = await resolveTrustAdmissionToken(prisma, {
    token: trustAdmissionToken,
    gLinkId,
  });

  if (resolution.resolved) {
    console.info("[trust-admission-token] Resolved", {
      gLinkId,
      identityId: resolution.identityId,
      tokenId: resolution.tokenId,
    });
    if (resolution.identityId && resolution.tokenId) {
      return {
        identityId: resolution.identityId,
        tokenId: resolution.tokenId,
      };
    }
  }

  console.warn("[trust-admission-token] Invalid", {
    gLinkId,
    reasons: resolution.reasons,
  });
  return null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;

  try {
    const parsedBody = await req.json();

    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return badRequest({
        code: "INVALID_REQUEST_BODY",
        error: "Invalid request body",
        reasons: ["body_must_be_object"],
      });
    }

    body = parsedBody as Record<string, unknown>;
  } catch {
    return badRequest({
      code: "INVALID_REQUEST_BODY",
      error: "Invalid request body",
      reasons: ["invalid_json"],
    });
  }

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
  const gLinkId = typeof body.gLinkId === "string" ? body.gLinkId : "";
  const documentName = typeof body.documentName === "string" ? body.documentName : "";
  const documentUrl = typeof body.documentUrl === "string" ? body.documentUrl : "";

  if (wantsCandidateNotifications && (!candidateNotificationEmail || !emailPattern.test(candidateNotificationEmail))) {
    return badRequest({
      code: "INVALID_NOTIFICATION_EMAIL",
      error: "Valid notification email required",
      gLinkId,
      reasons: ["candidate_notification_email_invalid"],
    });
  }

  if (!gLinkId || !candidateName || !candidateEmail || !messageBody) {
    return badRequest({
      code: "REQUIRED_FIELD_MISSING",
      error: "Missing required fields",
      gLinkId,
      reasons: [
        gLinkId ? null : "gLinkId_missing",
        candidateName ? null : "candidateName_missing",
        candidateEmail ? null : "candidateEmail_missing",
        messageBody ? null : "message_missing",
      ].filter((reason): reason is string => Boolean(reason)),
    });
  }

  const gLink = await prisma.gLink.findUnique({
    where: { id: gLinkId },
    include: { owner: { select: { email: true, notificationPreferences: true } } },
  });

  if (!gLink) {
    warnBadRequest({
      code: "GLINK_NOT_FOUND",
      gLinkId,
      reasons: ["gLink_not_found"],
    });

    return NextResponse.json(
      { error: "Link not found", code: "GLINK_NOT_FOUND", reasons: ["gLink_not_found"] },
      { status: 404 },
    );
  }

  const resolvedTrustAdmissionToken = await observeTrustAdmissionToken(body, gLink.id);
  const resolvedCandidateIdentityId = resolvedTrustAdmissionToken?.identityId ?? null;

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

    if (documentName && documentUrl) {
      const document = await prisma.document.create({
        data: {
          caseId: existingRelationCase.id,
          uploadedByEmail: candidateEmail,
          fileName: documentName,
          fileUrl: documentUrl,
          mimeType: "application/octet-stream",
        },
      });

      await createRelationEvent({
        caseId: existingRelationCase.id,
        type: "DOCUMENT_UPLOADED",
        actorType: "CANDIDATE",
        actorId: "CANDIDATE",
        payload: { documentId: document.id, fileName: documentName },
      });
    }

    await auditLog({
      caseId: existingRelationCase.id,
      actorEmail: candidateEmail,
      eventType: "MESSAGE_SENT",
      metadata: { existing: true },
    });

    if (documentName && documentUrl) {
      await auditLog({
        caseId: existingRelationCase.id,
        actorEmail: candidateEmail,
        eventType: "DOCUMENT_UPLOADED",
        metadata: { fileName: documentName },
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

    if (documentName && documentUrl && isNotificationEnabled(existingRelationCase.owner.notificationPreferences, "documents")) {
      await sendNewDocumentEmail({
        ownerEmail: existingRelationCase.owner.email,
        candidateEmail,
        caseId: existingRelationCase.id,
        caseTitle: existingRelationCase.gLink.title,
        candidateName: existingRelationCase.candidateName,
        fileName: documentName,
      });
    } else if (documentName && documentUrl) {
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

  const trustAdmissionMode = getTrustAdmissionModeForGLink(gLink.id);

  if (admissionTrustPolicy.policy && trustAdmissionMode) {
    const candidateIdentityId = resolvedCandidateIdentityId ?? null;

    try {
      const credentialAdmissionEvaluation = await evaluateTrustAdmission(prisma, {
        trustPolicyId: admissionTrustPolicy.policy.id,
        candidateIdentityId,
      });

      if (trustAdmissionMode === "ENFORCE" && !credentialAdmissionEvaluation.allowed) {
        console.warn("[trust-admission] Credential admission blocked", {
          route: "app/api/cases/route.ts",
          gLinkId: gLink.id,
          trustPolicyId: admissionTrustPolicy.policy.id,
          resolvedCandidateIdentityId,
          candidateIdentityId,
          allowed: credentialAdmissionEvaluation.allowed,
          mode: trustAdmissionMode,
          requiredCredentialTypes: credentialAdmissionEvaluation.requiredCredentialTypes,
          missingCredentialTypes: credentialAdmissionEvaluation.missingCredentialTypes,
          reasons: credentialAdmissionEvaluation.reasons,
          missingRequirements: credentialAdmissionEvaluation.missingRequirements,
        });

        return NextResponse.json(
          {
            error: "Admission blocked by Trust Admission requirements.",
            code: "TRUST_ADMISSION_BLOCKED",
            trustPolicyId: admissionTrustPolicy.policy.id,
            requiredCredentialTypes: credentialAdmissionEvaluation.requiredCredentialTypes,
            missingCredentialTypes: credentialAdmissionEvaluation.missingCredentialTypes,
            reasons: credentialAdmissionEvaluation.reasons,
            missingRequirements: credentialAdmissionEvaluation.missingRequirements,
          },
          { status: 403 },
        );
      }

      if (trustAdmissionMode === "ENFORCE") {
        console.info("[trust-admission] Credential admission enforce allowed", {
          route: "app/api/cases/route.ts",
          gLinkId: gLink.id,
          trustPolicyId: admissionTrustPolicy.policy.id,
          resolvedCandidateIdentityId,
          candidateIdentityId,
          allowed: credentialAdmissionEvaluation.allowed,
          mode: trustAdmissionMode,
          requiredCredentialTypes: credentialAdmissionEvaluation.requiredCredentialTypes,
          satisfiedCredentialTypes: credentialAdmissionEvaluation.satisfiedCredentialTypes,
          missingCredentialTypes: credentialAdmissionEvaluation.missingCredentialTypes,
          reasons: credentialAdmissionEvaluation.reasons,
          missingRequirements: credentialAdmissionEvaluation.missingRequirements,
        });
      } else if (trustAdmissionMode === "SIMULATE_BLOCK") {
        console.warn("[trust-admission] Credential admission simulated block", {
          route: "app/api/cases/route.ts",
          gLinkId: gLink.id,
          trustPolicyId: admissionTrustPolicy.policy.id,
          resolvedCandidateIdentityId,
          candidateIdentityId,
          allowed: credentialAdmissionEvaluation.allowed,
          mode: trustAdmissionMode,
          wouldHaveBlocked: !credentialAdmissionEvaluation.allowed,
          requiredCredentialTypes: credentialAdmissionEvaluation.requiredCredentialTypes,
          satisfiedCredentialTypes: credentialAdmissionEvaluation.satisfiedCredentialTypes,
          missingCredentialTypes: credentialAdmissionEvaluation.missingCredentialTypes,
          reasons: credentialAdmissionEvaluation.reasons,
          missingRequirements: credentialAdmissionEvaluation.missingRequirements,
        });
      } else {
        console.info("[trust-admission] Credential admission observe", {
          route: "app/api/cases/route.ts",
          gLinkId: gLink.id,
          trustPolicyId: admissionTrustPolicy.policy.id,
          resolvedCandidateIdentityId,
          candidateIdentityId,
          allowed: credentialAdmissionEvaluation.allowed,
          mode: trustAdmissionMode,
          requiredCredentialTypes: credentialAdmissionEvaluation.requiredCredentialTypes,
          satisfiedCredentialTypes: credentialAdmissionEvaluation.satisfiedCredentialTypes,
          missingCredentialTypes: credentialAdmissionEvaluation.missingCredentialTypes,
          reasons: credentialAdmissionEvaluation.reasons,
          missingRequirements: credentialAdmissionEvaluation.missingRequirements,
        });
      }
    } catch (error) {
      console.warn("[trust-admission] Credential admission evaluation failed", {
        route: "app/api/cases/route.ts",
        gLinkId: gLink.id,
        trustPolicyId: admissionTrustPolicy.policy.id,
        resolvedCandidateIdentityId,
        candidateIdentityId,
        mode: trustAdmissionMode,
        error: error instanceof Error ? error.message : String(error),
      });

      if (trustAdmissionMode === "ENFORCE") {
        return NextResponse.json(
          {
            error: "Trust Admission evaluation failed.",
            code: "TRUST_ADMISSION_EVALUATION_FAILED",
            trustPolicyId: admissionTrustPolicy.policy.id,
          },
          { status: 500 },
        );
      }
    }
  }

  const relationCase = await prisma.$transaction(async (tx) => {
    const identitySource = resolvedTrustAdmissionToken ? "TRUST_ADMISSION_TOKEN" : "AUTO_CREATED";
    let tokenMarkedUsed = false;
    let candidateIdentityId = resolvedTrustAdmissionToken?.identityId ?? null;

    if (!candidateIdentityId) {
      const candidateIdentity = await tx.goodissimaIdentity.create({
        data: {
          type: "PERSON",
          status: "UNVERIFIED",
        },
      });

      candidateIdentityId = candidateIdentity.id;
    }

    const createdRelationCase = await tx.relationCase.create({
      data: {
        gLinkId: gLink.id,
        ownerId: gLink.ownerId,
        templateId: relationTemplate?.id,
        candidateIdentityId,
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

    try {
      const candidateCreatedCredential = await issueCandidateCreatedCredentialInTransaction(tx, {
        identityId: candidateIdentityId,
        relationCaseId: createdRelationCase.id,
        source: "RELATION_CASE_ADMISSION",
      });

      console.info("[trust-credential] Candidate-created credential issued", {
        relationCaseId: createdRelationCase.id,
        candidateIdentityId,
        identitySource,
        credentialType: "CANDIDATE_CREATED",
        credentialId: candidateCreatedCredential.id,
      });
    } catch (error) {
      console.warn("[trust-credential] Candidate-created credential not issued", {
        relationCaseId: createdRelationCase.id,
        candidateIdentityId,
        identitySource,
        credentialType: "CANDIDATE_CREATED",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (resolvedTrustAdmissionToken) {
      await markTrustAdmissionTokenUsed(tx, resolvedTrustAdmissionToken.tokenId);
      tokenMarkedUsed = true;
    }

    console.info("[trust-identity] Candidate identity attached to relation case", {
      identitySource,
      relationCaseId: createdRelationCase.id,
      candidateIdentityId,
      tokenId: resolvedTrustAdmissionToken?.tokenId ?? null,
      tokenMarkedUsed,
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
    documentName && documentUrl
      ? await prisma.document.create({
          data: {
            caseId: relationCase.id,
            uploadedByEmail: candidateEmail,
            fileName: documentName,
            fileUrl: documentUrl,
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
      metadata: { fileName: documentName },
    });
    await createRelationEvent({
      caseId: relationCase.id,
      type: "DOCUMENT_UPLOADED",
      actorType: "CANDIDATE",
      actorId: "CANDIDATE",
      payload: { documentId: document.id, fileName: documentName },
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
