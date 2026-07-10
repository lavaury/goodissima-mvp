import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const result = await prisma.governedJourneyInvitation.updateMany({
    where: { id: params.id, ownerId: owner.id, status: { in: ["ACTIVE", "PREPARED"] } },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  return NextResponse.json({ revoked: result.count === 1 }, { status: result.count ? 200 : 404 });
}
