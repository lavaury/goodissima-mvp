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
  return (
    (invitation.status === "PENDING" || invitation.status === "ACCEPTED") &&
    (!invitation.expiresAt || invitation.expiresAt > new Date())
  );
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
  const decision = await getAccessInvitationDecision(email);

  if (!decision.allowed) {
    return {
      allowed: false as const,
      reason: decision.reason,
    };
  }

  return { allowed: true as const };
}

export async function getAccessInvitationDecision(email: string) {
  const privateAccessMode = isPrivateAccessMode();
  const normalizedEmail = normalizeInvitationEmail(email);
  const [existingUser, invitation] = await Promise.all([
    prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    }),
    prisma.accessInvitation.findUnique({
      where: { email: normalizedEmail },
      select: {
        status: true,
        expiresAt: true,
      },
    }),
  ]);
  const userExists = Boolean(existingUser);
  const invitationUsable = invitation ? isInvitationUsable(invitation) : false;
  const invitationExpired = Boolean(invitation?.expiresAt && invitation.expiresAt <= new Date());

  let allowed = true;
  let reason = "Mode acces prive inactif.";

  if (privateAccessMode) {
    allowed = userExists || invitationUsable;

    if (userExists) {
      reason = "Utilisateur existant autorise.";
    } else if (invitationUsable) {
      reason = "Invitation valide.";
    } else if (invitation?.status === "REVOKED") {
      reason = "Invitation revoquee.";
    } else if (invitationExpired) {
      reason = "Invitation expiree.";
    } else {
      reason = "Goodissima est en acces prive. Demandez une invitation pour creer un compte.";
    }
  }

  return {
    privateAccessMode,
    allowed,
    reason,
    userExists,
    invitationStatus: invitation?.status ?? null,
    invitationExpiresAt: invitation?.expiresAt?.toISOString() ?? null,
  };
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
