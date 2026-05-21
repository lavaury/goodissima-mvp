import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await getCurrentPrismaUser();

  const templates = await prisma.formTemplate.findMany({
    include: {
      _count: { select: { fields: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}
