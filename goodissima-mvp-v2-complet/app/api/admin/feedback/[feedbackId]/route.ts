import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  buildFeedbackStatusUpdate,
  canAccessFeedbackAdmin,
  cleanFeedbackString,
  normalizeFeedbackStatus,
} from "@/lib/product-feedback";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { feedbackId: string } }) {
  const owner = await getCurrentPrismaUser();

  if (!canAccessFeedbackAdmin(owner.role)) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const status = normalizeFeedbackStatus((body as { status?: unknown }).status);
  const adminNotes = cleanFeedbackString((body as { adminNotes?: unknown }).adminNotes, 2000);
  const feedback = await prisma.productFeedback.update({
    where: { id: params.feedbackId },
    data: buildFeedbackStatusUpdate(status, adminNotes),
    select: { id: true, status: true, resolvedAt: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, feedback });
}
