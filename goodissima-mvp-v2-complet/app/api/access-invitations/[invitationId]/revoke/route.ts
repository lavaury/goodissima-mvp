import { NextResponse } from "next/server";
import { ACCESS_INVITATION_EVENTS } from "@/lib/access-invitations";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { invitationId: string } },
) {
  const owner = await getCurrentPrismaUser();

  const invitation = await prisma.accessInvitation.update({
    where: { id: params.invitationId },
    data: { status: "REVOKED" },
  });

  await prisma.auditLog.create({
    data: {
      actorEmail: owner.email,
      eventType: ACCESS_INVITATION_EVENTS.REVOKED,
      metadata: {
        invitationId: invitation.id,
        email: invitation.email,
      },
    },
  });

  return NextResponse.json(invitation);
}
