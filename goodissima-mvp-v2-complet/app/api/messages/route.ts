import { NextResponse } from "next/server";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { auditLog } from "@/lib/audit";
import { getCurrentPrismaUser } from "@/lib/auth";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { sendNewMessageEmail, sendOwnerMessageToCandidateEmail } from "@/lib/email";
import { enqueueEmbeddingJob } from "@/lib/ai/embedding-jobs";
import { createRelationEvent } from "@/lib/events";
import { isNotificationEnabled } from "@/lib/privacy";
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
        candidateAccessToken: true,
        candidateEmail: true,
        candidateEmailNotificationsEnabled: true,
        candidateName: true,
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
      candidateAccessToken: true,
      candidateEmail: true,
      candidateEmailNotificationsEnabled: true,
      candidateName: true,
      gLink: { select: { title: true } },
      owner: { select: { email: true, notificationPreferences: true } },
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

  return NextResponse.json(messages.map(({ senderEmail: _senderEmail, ...message }) => message), {
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

  const senderEmail =
    body.senderType === "OWNER" ? relationCase.owner.email : relationCase.candidateEmail;

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

  await createRelationEvent({
    caseId: relationCase.id,
    type: "MESSAGE_SENT",
    actorType: body.senderType,
    actorId: body.senderType,
    payload: { messageId: message.id },
  });

  await enqueueEmbeddingJob({ relationCaseId: relationCase.id, triggerType: "message_created" });

  revalidatePath("/dashboard");
  revalidatePath(`/cases/${relationCase.id}`);
  if (body.candidateAccessToken) {
    revalidatePath(`/secure/${body.candidateAccessToken}`);
  }

  if (body.senderType === "CANDIDATE" && isNotificationEnabled(relationCase.owner.notificationPreferences, "messages")) {
    console.info("[owner-email] New candidate message email trigger", {
      caseId: relationCase.id,
      hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    });

    await sendNewMessageEmail({
      ownerEmail: relationCase.owner.email,
      candidateEmail: relationCase.candidateEmail,
      caseId: relationCase.id,
      caseTitle: relationCase.gLink.title,
      candidateName: relationCase.candidateName,
      messageBody: message.body,
    });
  }

  if (body.senderType === "OWNER" && relationCase.candidateEmailNotificationsEnabled) {
    console.info("[candidate-email] New owner message email trigger", {
      caseId: relationCase.id,
      secureLink: `/secure/${relationCase.candidateAccessToken}`,
      hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    });

    await sendOwnerMessageToCandidateEmail({
      candidateEmail: relationCase.candidateEmail,
      ownerEmail: relationCase.owner.email,
      caseTitle: relationCase.gLink.title,
      candidateName: relationCase.candidateName,
      candidateAccessToken: relationCase.candidateAccessToken,
      messageBody: message.body,
    });
  }

  const { senderEmail: _senderEmail, ...safeMessage } = message;
  return NextResponse.json(safeMessage);
}
