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
  const formData = await req.formData();
  const caseId = formData.get("caseId");
  const candidateAccessToken = formData.get("candidateAccessToken");
  const file = formData.get("file");
  const caseIdValue = typeof caseId === "string" && caseId ? caseId : null;
  const candidateAccessTokenValue =
    typeof candidateAccessToken === "string" && candidateAccessToken ? candidateAccessToken : null;

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
    return NextResponse.json({ error: reason, route, caseId: caseIdValue, reason }, { status: 400 });
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
    return NextResponse.json({ error: reason, route, caseId: caseIdValue, reason }, { status: 413 });
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
    return NextResponse.json({ error: reason, route, caseId: caseIdValue, reason }, { status: 415 });
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
    return NextResponse.json({ error: reason, route, caseId: caseIdValue, reason }, { status: 404 });
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

    return NextResponse.json(
      {
        error: reason,
        route,
        caseId: relationCase.id,
        governanceStatus,
        reason,
      },
      { status: 409 },
    );
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
    return NextResponse.json({ error: reason, route, caseId: relationCase.id, governanceStatus, reason }, { status: 400 });
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
    return NextResponse.json({ error: reason, route, caseId: relationCase.id, governanceStatus, reason }, { status: 500 });
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    const reason = uploadError.message || "Upload failed";
    console.error("[documents] Document upload storage failed", {
      route,
      caseId: relationCase.id,
      governanceStatus,
      storagePath,
      reason,
    });
    return NextResponse.json({ error: reason, route, caseId: relationCase.id, governanceStatus, reason }, { status: 500 });
  }

  const document = await prisma.document.create({
    data: {
      caseId: relationCase.id,
      uploadedByEmail: actorEmail,
      fileName: file.name,
      fileUrl: storagePath,
      mimeType: file.type || "application/octet-stream",
    },
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
        console.error("Unable to send new document email", error);
      }
    } else {
      logNotificationSkipped(relationCase.owner.notificationPreferences, "documents", {
        caseId: relationCase.id,
        event: "candidate_document_upload",
      });
    }
  }

  const { uploadedByEmail: _uploadedByEmail, fileUrl: _fileUrl, ...safeDocument } = document;
  return NextResponse.json(safeDocument);
}
