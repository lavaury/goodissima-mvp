import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { revokeGovernedJourneyInvitationAccess } from "@/lib/governed-journey-guest-access";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const revoked = await prisma.$transaction((tx) => revokeGovernedJourneyInvitationAccess(tx, { invitationId: params.id, ownerId: owner.id, now: new Date() }));
  return NextResponse.json({ revoked }, { status: revoked ? 200 : 404 });
}
