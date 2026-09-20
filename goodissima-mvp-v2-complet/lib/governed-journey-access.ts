import type { GovernedJourneyInvitationStatus, JourneyConsentStatus } from "@prisma/client";

export type ConsentAwareInvitation = {
  status: GovernedJourneyInvitationStatus;
  revokedAt: Date | null;
  accessTokenExpiresAt: Date;
  consent?: { status: JourneyConsentStatus } | null;
};

export function hasCurrentJourneyAccess(invitation: ConsentAwareInvitation, now = new Date()) {
  if (invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.accessTokenExpiresAt <= now) return false;
  return !invitation.consent || invitation.consent.status === "ACCEPTED";
}
