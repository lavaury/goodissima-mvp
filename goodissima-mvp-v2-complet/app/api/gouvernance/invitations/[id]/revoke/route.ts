import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const revoked = await prisma.$transaction(async (tx) => {
    const invitation = await tx.governedJourneyInvitation.findFirst({ where: { id: params.id, ownerId: owner.id }, include: { consent: true } });
    if (!invitation) return false;
    if (invitation.status === "REVOKED" || invitation.revokedAt) return true;
    const now = new Date();
    const result = await tx.governedJourneyInvitation.updateMany({ where: { id: invitation.id, ownerId: owner.id, status: { in: ["ACTIVE", "PREPARED"] }, revokedAt: null }, data: { status: "REVOKED", revokedAt: now } });
    if (result.count !== 1) return false;
    if (invitation.consent) await tx.governedJourneyConsentEvent.create({ data: { invitationId: invitation.id, consentId: invitation.consent.id, type: "REVOKED", actorUserId: owner.id, actorKind: "OWNER", occurredAt: now, consentVersion: invitation.consent.version, roleSnapshot: invitation.role } });
    return true;
  });
  return NextResponse.json({ revoked }, { status: revoked ? 200 : 404 });
}
