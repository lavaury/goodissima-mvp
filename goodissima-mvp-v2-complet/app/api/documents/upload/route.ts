import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "case-documents";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "docx"]);

async function resolveCaseForAccess(params: {
  caseId?: string | null;
  candidateAccessToken?: string | null;
}) {
  if (params.candidateAccessToken) {
    return prisma.relationCase.findFirst({
      where: activeCandidateAccessWhere(params.candidateAccessToken),
      select: { id: true, candidateEmail: true },
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
    select: { id: true, candidateEmail: true },
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
  const formData = await req.formData();
  const caseId = formData.get("caseId");
  const candidateAccessToken = formData.get("candidateAccessToken");
  const uploadedByEmail = formData.get("uploadedByEmail");
  const file = formData.get("file");

  if (
    (!(typeof caseId === "string" && caseId) &&
      !(typeof candidateAccessToken === "string" && candidateAccessToken)) ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  if (!isAllowedFile(file)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const relationCase = await resolveCaseForAccess({
    caseId: typeof caseId === "string" ? caseId : null,
    candidateAccessToken:
      typeof candidateAccessToken === "string" ? candidateAccessToken : null,
  });

  if (!relationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const actorEmail =
    typeof candidateAccessToken === "string" && candidateAccessToken
      ? relationCase.candidateEmail
      : typeof uploadedByEmail === "string"
        ? uploadedByEmail
        : null;

  if (!actorEmail) {
    return NextResponse.json({ error: "Missing uploader email" }, { status: 400 });
  }

  const safeFileName = sanitizeFileName(file.name);
  const storagePath = `${relationCase.id}/${crypto.randomUUID()}-${safeFileName}`;
  const supabase = createAdminClient();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
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

  return NextResponse.json(document);
}
