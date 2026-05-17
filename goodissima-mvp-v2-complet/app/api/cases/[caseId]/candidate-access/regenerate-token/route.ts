import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { createCandidateAccessExpiresAt, createCandidateAccessToken } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { caseId: string } }) {
  const owner = await getCurrentPrismaUser();

  const relationCase = await prisma.relationCase.findFirst({
    where: { id: params.caseId, ownerId: owner.id },
    select: { id: true },
  });

  if (!relationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const updated = await prisma.relationCase.update({
    where: { id: relationCase.id },
    data: {
      candidateAccessToken: createCandidateAccessToken(),
      candidateAccessExpiresAt: createCandidateAccessExpiresAt(),
      candidateAccessRevokedAt: null,
    },
    select: {
      id: true,
      candidateAccessToken: true,
      candidateAccessExpiresAt: true,
      candidateAccessRevokedAt: true,
    },
  });

  await auditLog({
    caseId: relationCase.id,
    actorEmail: owner.email,
    eventType: "CANDIDATE_ACCESS_REGENERATED",
  });

  return NextResponse.json(updated);
}
