import { NextResponse } from "next/server";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { sendNewMessageEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
        gLink: { select: { title: true } },
        owner: { select: { email: true } },
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
      gLink: { select: { title: true } },
      owner: { select: { email: true } },
    },
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

  const messages = await prisma.message.findMany({
    where: { caseId: relationCase.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
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

  revalidatePath("/dashboard");
  revalidatePath(`/cases/${relationCase.id}`);
  if (body.candidateAccessToken) {
    revalidatePath(`/secure/${body.candidateAccessToken}`);
  }

  if (body.senderType === "CANDIDATE") {
    console.log("New candidate message email trigger:", {
      caseId: relationCase.id,
      to: relationCase.owner.email,
      hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    });

    try {
      await sendNewMessageEmail({
        ownerEmail: relationCase.owner.email,
        caseId: relationCase.id,
        caseTitle: relationCase.gLink.title,
        candidateName: relationCase.candidateName,
        messageBody: message.body,
      });
    } catch (error) {
      console.error("Unable to send new message email:", error);
    }
  }

  return NextResponse.json(message);
}
