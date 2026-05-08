import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get("caseId");

  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  }

  const messages = await prisma.message.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.caseId || !body.senderEmail || !body.senderType || !body.body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      caseId: body.caseId,
      senderType: body.senderType,
      senderEmail: body.senderEmail,
      body: body.body,
    },
  });

  await auditLog({
    caseId: body.caseId,
    actorEmail: body.senderEmail,
    eventType: "MESSAGE_SENT",
  });

  return NextResponse.json(message);
}
