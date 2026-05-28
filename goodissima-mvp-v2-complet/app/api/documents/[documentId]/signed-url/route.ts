import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "case-documents";
const SIGNED_URL_TTL_SECONDS = 5 * 60;

async function resolveDocumentForAccess(params: {
  documentId: string;
  caseId?: string | null;
  candidateAccessToken?: string | null;
}) {
  if (params.candidateAccessToken) {
    const relationCase = await prisma.relationCase.findFirst({
      where: activeCandidateAccessWhere(params.candidateAccessToken),
      select: { id: true },
    });

    if (!relationCase) return null;

    return prisma.document.findFirst({
      where: { id: params.documentId, caseId: relationCase.id },
      select: { fileName: true, fileUrl: true },
    });
  }

  if (!params.caseId) return null;

  let owner;
  try {
    owner = await getCurrentPrismaUser();
  } catch {
    return null;
  }

  return prisma.document.findFirst({
    where: {
      id: params.documentId,
      caseId: params.caseId,
      relationCase: { ownerId: owner.id },
    },
    select: { fileName: true, fileUrl: true },
  });
}

export async function POST(req: Request, { params }: { params: { documentId: string } }) {
  const body = await req.json();

  const document = await resolveDocumentForAccess({
    documentId: params.documentId,
    caseId: body.caseId,
    candidateAccessToken: body.candidateAccessToken,
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(document.fileUrl, SIGNED_URL_TTL_SECONDS, {
      download: document.fileName,
    });

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Unable to create signed URL" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
