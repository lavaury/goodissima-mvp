import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { sendNewDocumentEmail } from "@/lib/email";
import { enqueueEmbeddingJob } from "@/lib/ai/embedding-jobs";
import { createRelationEvent } from "@/lib/events";
import { isNotificationEnabled, logNotificationSkipped } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";
import {
  canWriteInRelation,
  getRelationGovernanceBlockedMessage,
  normalizeRelationGovernanceStatus,
} from "@/lib/relation-governance";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "case-documents";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "doc", "docx"]);

type UploadFailureStage = "validation" | "access" | "governance" | "storage" | "database" | "notification";

function getSupabaseUrlHostname() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return "invalid-url";
  }
}

function uploadErrorResponse(params: {
  stage: UploadFailureStage;
  status: number;
  message: string;
  route: string;
  caseId?: string | null;
  governanceStatus?: string | null;
  code?: string | null;
  details?: unknown;
}) {
  return NextResponse.json(
    {
      error: params.message,
      stage: params.stage,
      code: params.code ?? null,
      message: params.message,
      route: params.route,
      caseId: params.caseId ?? null,
      governanceStatus: params.governanceStatus ?? null,
      details: params.details ?? null,
    },
    { status: params.status },
  );
}

async function resolveCaseForAccess(params: {
  caseId?: string | null;
  candidateAccessToken?: string | null;
}) {
  if (params.candidateAccessToken) {
    return prisma.relationCase.findFirst({
      where: activeCandidateAccessWhere(params.candidateAccessToken),
      select: {
        id: true,
        candidateEmail: true,
        candidateName: true,
        governanceStatus: true,
        gLink: { select: { title: true } },
        owner: { select: { email: true, notificationPreferences: true } },
      },
    });
  }

  if (!params.caseId) return null;

  let owner;
  try {
    owner = await getCurrentPrismaUser();
  } catch {
    return null;
  }

  return prisma.relationCase.findFirst({
    where: { id: params.caseId, ownerId: owner.id },
    select: {
      id: true,
      candidateEmail: true,
      candidateName: true,
      governanceStatus: true,
      gLink: { select: { title: true } },
      owner: { select: { email: true, notificationPreferences: true } },
    },
  });
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isAllowedFile(file: File) {
  return ALLOWED_MIME_TYPES.has(file.type) || ALLOWED_EXTENSIONS.has(getFileExtension(file.name));
}

export async function POST(req: Request) {
  const route = "app/api/documents/upload/route.ts";
  const supabaseHostname = getSupabaseUrlHostname();
  const formData = await req.formData();
  const caseId = formData.get("caseId");
  const candidateAccessToken = formData.get("candidateAccessToken");
  const file = formData.get("file");
  const caseIdValue = typeof caseId === "string" && caseId ? caseId : null;
  const candidateAccessTokenValue =
    typeof candidateAccessToken === "string" && candidateAccessToken ? candidateAccessToken : null;

  console.info("[documents] Upload route called", {
    route,
    caseId: caseIdValue,
    hasCandidateAccessToken: Boolean(candidateAccessTokenValue),
    hasFile: file instanceof File,
    fileName: file instanceof File ? file.name : null,
    fileSize: file instanceof File ? file.size : null,
    bucket: BUCKET_NAME,
    supabaseHostname,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });

  if (
    (!caseIdValue && !candidateAccessTokenValue) ||
    !(file instanceof File)
  ) {
    const reason = "Missing required fields";
    console.warn("[documents] Document upload rejected", {
      route,
      caseId: caseIdValue,
      hasCandidateAccessToken: Boolean(candidateAccessTokenValue),
      hasFile: file instanceof File,
      reason,
    });
    return uploadErrorResponse({
      stage: "validation",
      status: 400,
      message: reason,
      route,
      caseId: caseIdValue,
      code: "MISSING_REQUIRED_FIELDS",
    });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const reason = "File too large";
    console.warn("[documents] Document upload rejected", {
      route,
      caseId: caseIdValue,
      fileName: file.name,
      fileSize: file.size,
      reason,
    });
    return uploadErrorResponse({
      stage: "validation",
      status: 413,
      message: reason,
      route,
      caseId: caseIdValue,
      code: "FILE_TOO_LARGE",
      details: { fileName: file.name, fileSize: file.size, maxFileSize: MAX_FILE_SIZE_BYTES },
    });
  }

  if (!isAllowedFile(file)) {
    const reason = "Unsupported file type";
    console.warn("[documents] Document upload rejected", {
      route,
      caseId: caseIdValue,
      fileName: file.name,
      mimeType: file.type,
      extension: getFileExtension(file.name),
      reason,
    });
    return uploadErrorResponse({
      stage: "validation",
      status: 415,
      message: reason,
      route,
      caseId: caseIdValue,
      code: "UNSUPPORTED_FILE_TYPE",
      details: { fileName: file.name, mimeType: file.type, extension: getFileExtension(file.name) },
    });
  }

  const relationCase = await resolveCaseForAccess({
    caseId: caseIdValue,
    candidateAccessToken: candidateAccessTokenValue,
  });

  if (!relationCase) {
    const reason = "Case not found";
    console.warn("[documents] Document upload rejected", {
      route,
      caseId: caseIdValue,
      hasCandidateAccessToken: Boolean(candidateAccessTokenValue),
      reason,
    });
    return uploadErrorResponse({
      stage: "access",
      status: 404,
      message: reason,
      route,
      caseId: caseIdValue,
      code: "CASE_NOT_FOUND",
    });
  }

  const governanceStatus = normalizeRelationGovernanceStatus(relationCase.governanceStatus);

  if (!canWriteInRelation(governanceStatus)) {
    const reason = getRelationGovernanceBlockedMessage(governanceStatus);
    console.warn("[documents] Document upload blocked by governance", {
      route,
      caseId: relationCase.id,
      governanceStatus,
      reason,
    });

    return uploadErrorResponse({
      stage: "governance",
      status: 409,
      message: reason,
      route,
      caseId: relationCase.id,
      governanceStatus,
      code: "GOVERNANCE_BLOCKED",
    });
  }

  const actorEmail =
    typeof candidateAccessToken === "string" && candidateAccessToken
      ? relationCase.candidateEmail
      : relationCase.owner.email;

  if (!actorEmail) {
    const reason = "Missing uploader email";
    console.warn("[documents] Document upload rejected", {
      route,
      caseId: relationCase.id,
      governanceStatus,
      reason,
    });
    return uploadErrorResponse({
      stage: "access",
      status: 400,
      message: reason,
      route,
      caseId: relationCase.id,
      governanceStatus,
      code: "MISSING_UPLOADER_EMAIL",
    });
  }

  const safeFileName = sanitizeFileName(file.name);
  const storagePath = `${relationCase.id}/${crypto.randomUUID()}-${safeFileName}`;
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Missing Supabase admin environment variables";
    console.error("[documents] Document upload storage client failed", {
      route,
      caseId: relationCase.id,
      governanceStatus,
      reason,
    });
    return uploadErrorResponse({
      stage: "storage",
      status: 500,
      message: reason,
      route,
      caseId: relationCase.id,
      governanceStatus,
      code: "SUPABASE_ADMIN_CLIENT_FAILED",
      details: { supabaseHostname, hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    });
  }

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

  console.info("[documents] Supabase storage upload result", {
    route,
    caseId: relationCase.id,
    bucket: BUCKET_NAME,
    supabaseHostname,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadData,
    hasUploadError: Boolean(uploadError),
  });

  if (uploadError) {
    const reason = uploadError.message || "Upload failed";
    console.error("[documents] Document upload storage failed", {
      route,
      caseId: relationCase.id,
      governanceStatus,
      bucket: BUCKET_NAME,
      supabaseHostname,
      storagePath,
      reason,
      supabaseError: uploadError,
    });
    return uploadErrorResponse({
      stage: "storage",
      status: 500,
      message: reason,
      route,
      caseId: relationCase.id,
      governanceStatus,
      code: "SUPABASE_STORAGE_UPLOAD_FAILED",
      details: uploadError,
    });
  }

  let document;
  try {
    document = await prisma.document.create({
      data: {
        caseId: relationCase.id,
        uploadedByEmail: actorEmail,
        fileName: file.name,
        fileUrl: storagePath,
        mimeType: file.type || "application/octet-stream",
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Document database creation failed";
    console.error("[documents] Document database creation failed", {
      route,
      caseId: relationCase.id,
      governanceStatus,
      storagePath,
      reason,
      databaseError: error,
    });
    return uploadErrorResponse({
      stage: "database",
      status: 500,
      message: reason,
      route,
      caseId: relationCase.id,
      governanceStatus,
      code: "DOCUMENT_DATABASE_CREATE_FAILED",
    });
  }

  console.info("[documents] Document database creation succeeded", {
    route,
    caseId: relationCase.id,
    documentId: document.id,
    fileName: document.fileName,
    storagePath: document.fileUrl,
  });

  await auditLog({
    caseId: relationCase.id,
    actorEmail,
    eventType: "DOCUMENT_UPLOADED",
    metadata: { fileName: file.name },
  });

  await createRelationEvent({
    caseId: relationCase.id,
    type: "DOCUMENT_UPLOADED",
    actorType: typeof candidateAccessToken === "string" && candidateAccessToken ? "CANDIDATE" : "OWNER",
    actorId: typeof candidateAccessToken === "string" && candidateAccessToken ? "CANDIDATE" : "OWNER",
    payload: { documentId: document.id, fileName: file.name },
  });

  await enqueueEmbeddingJob({ relationCaseId: relationCase.id, triggerType: "document_uploaded" });

  revalidatePath("/dashboard");
  revalidatePath(`/cases/${relationCase.id}`);
  if (typeof candidateAccessToken === "string" && candidateAccessToken) {
    revalidatePath(`/secure/${candidateAccessToken}`);
  }

  if (typeof candidateAccessToken === "string" && candidateAccessToken) {
    if (isNotificationEnabled(relationCase.owner.notificationPreferences, "documents")) {
      try {
        await sendNewDocumentEmail({
          ownerEmail: relationCase.owner.email,
          candidateEmail: relationCase.candidateEmail,
          caseId: relationCase.id,
          caseTitle: relationCase.gLink.title,
          candidateName: relationCase.candidateName,
          fileName: document.fileName,
        });
      } catch (error) {
        console.error("[documents] Document notification failed", {
          route,
          caseId: relationCase.id,
          documentId: document.id,
          stage: "notification",
          reason: error instanceof Error ? error.message : "Unable to send new document email",
          notificationError: error,
        });
      }
    } else {
      logNotificationSkipped(relationCase.owner.notificationPreferences, "documents", {
        caseId: relationCase.id,
        event: "candidate_document_upload",
      });
    }
  }

  console.info("[documents] Document upload completed", {
    route,
    caseId: relationCase.id,
    documentId: document.id,
    bucket: BUCKET_NAME,
    storagePath,
  });

  const { uploadedByEmail: _uploadedByEmail, fileUrl: _fileUrl, ...safeDocument } = document;
  return NextResponse.json(safeDocument);
}
