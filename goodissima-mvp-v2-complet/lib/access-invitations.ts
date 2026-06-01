import { AccessInvitationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ACCESS_INVITATION_EVENTS = {
  CREATED: "ACCESS_INVITATION_CREATED",
  ACCEPTED: "ACCESS_INVITATION_ACCEPTED",
  REVOKED: "ACCESS_INVITATION_REVOKED",
} as const;

export function getPrivateAccessModeEnv() {
  return process.env.PRIVATE_ACCESS_MODE ?? process.env.PRIVATE_ACCES_MODE ?? "false";
}

export function isPrivateAccessMode() {
  return getPrivateAccessModeEnv().toLowerCase() === "true";
}

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isInvitationUsable(invitation: {
  status: AccessInvitationStatus;
  expiresAt: Date | null;
}) {
  return invitation.status !== "REVOKED" && (!invitation.expiresAt || invitation.expiresAt > new Date());
}

export async function findUsableInvitation(email: string) {
  const invitation = await prisma.accessInvitation.findUnique({
    where: { email: normalizeInvitationEmail(email) },
  });

  if (!invitation || !isInvitationUsable(invitation)) {
    return null;
  }

  return invitation;
}

export async function assertSignupAllowed(email: string) {
  if (!isPrivateAccessMode()) {
    return { allowed: true as const };
  }

  const normalizedEmail = normalizeInvitationEmail(email);
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return { allowed: true as const };
  }

  const invitation = await findUsableInvitation(normalizedEmail);

  if (!invitation) {
    return {
      allowed: false as const,
      reason: "Goodissima est en acces prive. Demandez une invitation pour creer un compte.",
    };
  }

  return { allowed: true as const, invitation };
}

export async function acceptInvitationForEmail(
  tx: Prisma.TransactionClient,
  email: string,
  actorEmail: string,
) {
  const normalizedEmail = normalizeInvitationEmail(email);
  const invitation = await tx.accessInvitation.findUnique({
    where: { email: normalizedEmail },
  });

  if (!invitation || !isInvitationUsable(invitation) || invitation.status === "ACCEPTED") {
    return;
  }

  const acceptedAt = new Date();

  await tx.accessInvitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt },
  });

  await tx.auditLog.create({
    data: {
      actorEmail,
      eventType: ACCESS_INVITATION_EVENTS.ACCEPTED,
      metadata: {
        invitationId: invitation.id,
        email: normalizedEmail,
        acceptedAt: acceptedAt.toISOString(),
      },
    },
  });
}
