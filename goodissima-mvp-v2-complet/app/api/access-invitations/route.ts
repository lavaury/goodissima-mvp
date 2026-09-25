import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  ACCESS_INVITATION_EVENTS,
  normalizeInvitationEmail,
} from "@/lib/access-invitations";
import { prisma } from "@/lib/prisma";
import { canManagePrivatePlatformAccess } from "@/lib/private-platform-access";

function forbidden() {
  return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
}

export async function GET() {
  const owner = await getCurrentPrismaUser();
  if (!canManagePrivatePlatformAccess(owner)) return forbidden();

  const invitations = await prisma.accessInvitation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(invitations);
}

export async function POST(req: Request) {
  const owner = await getCurrentPrismaUser();
  if (!canManagePrivatePlatformAccess(owner)) return forbidden();
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? normalizeInvitationEmail(body.email) : "";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!email) {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const invitation = await prisma.accessInvitation.upsert({
    where: { email },
    create: {
      email,
      note,
      invitedByUserId: owner.id,
    },
    update: {
      note,
      invitedByUserId: owner.id,
      status: "PENDING",
      acceptedAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorEmail: owner.email,
      eventType: ACCESS_INVITATION_EVENTS.CREATED,
      metadata: {
        invitationId: invitation.id,
        email: invitation.email,
      },
    },
  });

  return NextResponse.json(invitation);
}
