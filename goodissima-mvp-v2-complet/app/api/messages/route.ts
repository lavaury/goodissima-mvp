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

export async function GET(req: Request) {
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

  const messages = await prisma.message.findMany({
    where: { caseId: relationCase.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  const body = await req.json();

  if ((!body.caseId && !body.candidateAccessToken) || !body.senderType || !body.body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const relationCase = await resolveCaseForAccess({
    caseId: body.caseId,
    candidateAccessToken: body.candidateAccessToken,
  });

  if (!relationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const senderEmail = body.candidateAccessToken ? relationCase.candidateEmail : body.senderEmail;

  if (!senderEmail) {
    return NextResponse.json({ error: "Missing sender email" }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      caseId: relationCase.id,
      senderType: body.senderType,
      senderEmail,
      body: body.body,
    },
  });

  await auditLog({
    caseId: relationCase.id,
    actorEmail: senderEmail,
    eventType: "MESSAGE_SENT",
  });

  return NextResponse.json(message);
}
