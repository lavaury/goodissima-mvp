import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { isGoodissimaDebugMode } from "@/lib/debug";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  if (!isGoodissimaDebugMode()) {
    return NextResponse.json({ error: "Debug mode disabled" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "DELETE") {
    return NextResponse.json({ error: "DELETE confirmation required" }, { status: 400 });
  }

  const owner = await getCurrentPrismaUser();
  const relationCase = await prisma.relationCase.findUnique({
    where: { id: params.caseId },
    select: {
      id: true,
      gLinkId: true,
      ownerId: true,
      gLink: { select: { ownerId: true } },
    },
  });

  if (!relationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (relationCase.ownerId !== owner.id || relationCase.gLink.ownerId !== owner.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  console.info("[debug-delete-case] Deleting case", {
    caseId: relationCase.id,
    ownerId: owner.id,
  });

  const [
    relationEvents,
    relationActions,
    messages,
    documents,
    formSubmissions,
    auditLogs,
    deletedCase,
  ] = await prisma.$transaction([
    prisma.relationEvent.deleteMany({ where: { caseId: relationCase.id } }),
    prisma.relationAction.deleteMany({ where: { relationCaseId: relationCase.id } }),
    prisma.message.deleteMany({ where: { caseId: relationCase.id } }),
    prisma.document.deleteMany({ where: { caseId: relationCase.id } }),
    prisma.formSubmission.deleteMany({ where: { caseId: relationCase.id } }),
    prisma.auditLog.deleteMany({ where: { caseId: relationCase.id } }),
    prisma.relationCase.delete({ where: { id: relationCase.id } }),
  ]);

  const existsAfterDelete = Boolean(
    await prisma.relationCase.findUnique({
      where: { id: relationCase.id },
      select: { id: true },
    }),
  );

  console.info("[debug-delete-case] Deleted case", {
    caseId: relationCase.id,
    ownerId: owner.id,
    deletedCounts: {
      relationEvents: relationEvents.count,
      relationActions: relationActions.count,
      messages: messages.count,
      documents: documents.count,
      formSubmissions: formSubmissions.count,
      auditLogs: auditLogs.count,
      relationCases: deletedCase.id ? 1 : 0,
    },
    existsAfterDelete,
  });

  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath(`/links/${relationCase.gLinkId}`);
  revalidatePath(`/cases/${relationCase.id}`);

  return NextResponse.json(
    {
      ok: true,
      existsAfterDelete,
      deletedCounts: {
        relationEvents: relationEvents.count,
        relationActions: relationActions.count,
        messages: messages.count,
        documents: documents.count,
        formSubmissions: formSubmissions.count,
        auditLogs: auditLogs.count,
        relationCases: deletedCase.id ? 1 : 0,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    },
  );
}
