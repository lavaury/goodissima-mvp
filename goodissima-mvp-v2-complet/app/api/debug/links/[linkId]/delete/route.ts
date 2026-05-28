import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { isGoodissimaDebugMode } from "@/lib/debug";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { linkId: string } }) {
  if (!isGoodissimaDebugMode()) {
    return NextResponse.json({ error: "Debug mode disabled" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "DELETE") {
    return NextResponse.json({ error: "DELETE confirmation required" }, { status: 400 });
  }

  const owner = await getCurrentPrismaUser();
  const link = await prisma.gLink.findUnique({
    where: { id: params.linkId },
    select: {
      id: true,
      ownerId: true,
      cases: { select: { id: true } },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (link.ownerId !== owner.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const caseIds = link.cases.map((relationCase) => relationCase.id);

  const [
    relationEvents,
    relationActions,
    messages,
    documents,
    formSubmissions,
    auditLogs,
    relationCases,
    deletedLink,
  ] = await prisma.$transaction([
    prisma.relationEvent.deleteMany({ where: { caseId: { in: caseIds } } }),
    prisma.relationAction.deleteMany({ where: { relationCaseId: { in: caseIds } } }),
    prisma.message.deleteMany({ where: { caseId: { in: caseIds } } }),
    prisma.document.deleteMany({ where: { caseId: { in: caseIds } } }),
    prisma.formSubmission.deleteMany({ where: { caseId: { in: caseIds } } }),
    prisma.auditLog.deleteMany({ where: { caseId: { in: caseIds } } }),
    prisma.relationCase.deleteMany({ where: { id: { in: caseIds } } }),
    prisma.gLink.delete({ where: { id: link.id } }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath(`/links/${link.id}`);

  return NextResponse.json({
    ok: true,
    deletedCounts: {
      relationEvents: relationEvents.count,
      relationActions: relationActions.count,
      messages: messages.count,
      documents: documents.count,
      formSubmissions: formSubmissions.count,
      auditLogs: auditLogs.count,
      relationCases: relationCases.count,
      links: deletedLink.id ? 1 : 0,
    },
  });
}
