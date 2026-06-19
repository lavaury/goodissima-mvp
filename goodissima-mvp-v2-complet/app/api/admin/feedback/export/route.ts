import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  buildFeedbackWhere,
  buildProductFeedbackCsv,
  canAccessFeedbackAdmin,
} from "@/lib/product-feedback";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const owner = await getCurrentPrismaUser();

  if (!canAccessFeedbackAdmin(owner.role)) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const url = new URL(req.url);
  const rows = await prisma.productFeedback.findMany({
    where: buildFeedbackWhere({
      type: url.searchParams.get("type"),
      status: url.searchParams.get("status"),
      search: url.searchParams.get("search"),
    }),
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      attachments: { select: { id: true } },
    },
  });
  const csv = buildProductFeedbackCsv(rows);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="goodissima-feedback-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
