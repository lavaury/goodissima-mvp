import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { createRelationEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import {
  canWriteInRelation,
  getRelationGovernanceBlockedMessage,
  normalizeRelationGovernanceStatus,
} from "@/lib/relation-governance";

export const dynamic = "force-dynamic";

async function resolveCaseForAccess(params: {
  caseId?: string | null;
  candidateAccessToken?: string | null;
}) {
  if (params.candidateAccessToken) {
    return prisma.relationCase.findFirst({
      where: activeCandidateAccessWhere(params.candidateAccessToken),
      select: { id: true, candidateEmail: true, governanceStatus: true, owner: { select: { email: true } } },
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
    select: { id: true, candidateEmail: true, governanceStatus: true, owner: { select: { email: true } } },
  });
}

export async function GET(req: Request) {
  noStore();

  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get("caseId");
  const candidateAccessToken = searchParams.get("candidateAccessToken");

  if (!caseId && !candidateAccessToken) {
    return NextResponse.json({ error: "Missing case reference" }, { status: 400 });
  }

  const relationCase = await resolveCaseForAccess({ caseId, candidateAccessToken });

  if (!relationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const documents = await prisma.document.findMany({
    where: { caseId: relationCase.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    documents.map(({ uploadedByEmail: _uploadedByEmail, fileUrl: _fileUrl, ...document }) => document),
  );
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

  const governanceStatus = normalizeRelationGovernanceStatus(relationCase.governanceStatus);

  if (!canWriteInRelation(governanceStatus)) {
    const reason = getRelationGovernanceBlockedMessage(governanceStatus);
    console.warn("[documents] Document creation blocked by governance", {
      route: "app/api/documents/route.ts",
      caseId: relationCase.id,
      governanceStatus,
      reason,
    });

    return NextResponse.json(
      {
        error: reason,
        route: "app/api/documents/route.ts",
        caseId: relationCase.id,
        governanceStatus,
        reason,
      },
      { status: 409 },
    );
  }

  const uploadedByEmail = body.candidateAccessToken
    ? relationCase.candidateEmail
    : relationCase.owner.email;

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

  await createRelationEvent({
    caseId: relationCase.id,
    type: "DOCUMENT_UPLOADED",
    actorType: body.candidateAccessToken ? "CANDIDATE" : "OWNER",
    actorId: body.candidateAccessToken ? "CANDIDATE" : "OWNER",
    payload: { documentId: document.id, fileName: body.fileName },
  });

  const { uploadedByEmail: _uploadedByEmail, fileUrl: _fileUrl, ...safeDocument } = document;
  return NextResponse.json(safeDocument);
}
