import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { rotateExternalGuestAccess } from "@/lib/governed-journey-guest-access";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const now = new Date();
  const result = await prisma.$transaction((tx) => rotateExternalGuestAccess(tx, {
    invitationId: params.id,
    ownerId: owner.id,
    now,
    expiresAt: new Date(now.getTime() + 7 * 86_400_000),
  }));
  if (!result) return NextResponse.json({ error: "Ce lien personnel ne peut pas être renouvelé." }, { status: 409 });
  return NextResponse.json({ link: `${new URL(request.url).origin}/gouvernance/invitation/${result.token}` });
}
