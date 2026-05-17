import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";

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

export async function POST(req: Request) {
  const body = await req.json();

  if ((!body.caseId && !body.candidateAccessToken) || !body.fileName || !body.fileUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const relationCase = await resolveCaseForAccess({
    caseId: body.caseId,
    candidateAccessToken: body.candidateAccessToken,
  });

  if (!relationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const uploadedByEmail = body.candidateAccessToken
    ? relationCase.candidateEmail
    : body.uploadedByEmail;

  if (!uploadedByEmail) {
    return NextResponse.json({ error: "Missing uploader email" }, { status: 400 });
  }

  const document = await prisma.document.create({
    data: {
      caseId: relationCase.id,
      uploadedByEmail,
      fileName: body.fileName,
      fileUrl: body.fileUrl,
      mimeType: body.mimeType || "application/octet-stream",
    },
  });

  await auditLog({
    caseId: relationCase.id,
    actorEmail: uploadedByEmail,
    eventType: "DOCUMENT_UPLOADED",
    metadata: { fileName: body.fileName },
  });

  return NextResponse.json(document);
}
