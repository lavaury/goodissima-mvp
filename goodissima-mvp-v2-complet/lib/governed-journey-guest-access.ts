import type { Prisma } from "@prisma/client";
import { createJourneyInvitationToken, hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";

export async function rotateExternalGuestAccess(
  tx: Prisma.TransactionClient,
  input: { invitationId: string; ownerId: string; now: Date; expiresAt: Date },
) {
  const invitation = await tx.governedJourneyInvitation.findFirst({
    where: { id: input.invitationId, ownerId: input.ownerId, inviteeUserId: null },
    include: { consent: true },
  });
  if (!invitation || invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.accessTokenExpiresAt <= input.now || invitation.consent?.status !== "ACCEPTED") return null;
  const token = createJourneyInvitationToken();
  const updated = await tx.governedJourneyInvitation.updateMany({
    where: { id: invitation.id, ownerId: input.ownerId, inviteeUserId: null, status: "ACTIVE", revokedAt: null },
    data: { accessTokenHash: hashJourneyInvitationToken(token), accessTokenExpiresAt: input.expiresAt },
  });
  return updated.count === 1 ? { invitationId: invitation.id, token } : null;
}

export async function revokeGovernedJourneyInvitationAccess(
  tx: Prisma.TransactionClient,
  input: { invitationId: string; ownerId: string; now: Date },
) {
  const invitation = await tx.governedJourneyInvitation.findFirst({
    where: { id: input.invitationId, ownerId: input.ownerId },
    include: { consent: true },
  });
  if (!invitation) return false;
  if (invitation.status === "REVOKED" || invitation.revokedAt) return true;
  const result = await tx.governedJourneyInvitation.updateMany({
    where: { id: invitation.id, ownerId: input.ownerId, status: { in: ["ACTIVE", "PREPARED"] }, revokedAt: null },
    data: { status: "REVOKED", revokedAt: input.now },
  });
  if (result.count !== 1) return false;
  await tx.governedMeetingParticipant.updateMany({
    where: { governedJourneyInvitationId: invitation.id, status: "AUTHORIZED" },
    data: { status: "REMOVED", removedAt: input.now },
  });
  await tx.governedJourneyExpectedRoleAssignment.updateMany({
    where: { assigneeInvitationId: invitation.id, revokedAt: null },
    data: { revokedAt: input.now, revokedByUserId: input.ownerId },
  });
  if (invitation.consent) await tx.governedJourneyConsentEvent.create({
    data: { invitationId: invitation.id, consentId: invitation.consent.id, type: "REVOKED", actorUserId: input.ownerId, actorKind: "OWNER", occurredAt: input.now, consentVersion: invitation.consent.version, roleSnapshot: invitation.role },
  });
  return true;
}
