import type {
  GovernedParticipantSelectionEligibility,
  JourneyConsentStatus,
} from "@prisma/client";
import { hasCurrentJourneyAccess } from "./governed-journey-access.ts";

export const GOVERNED_PARTICIPANT_SELECTION_LIMIT = 100;

export type JourneyMemberInvitation = {
  id: string;
  inviteeUserId: string | null;
  displayName: string;
  status: "PREPARED" | "ACTIVE" | "REVOKED" | "EXPIRED";
  revokedAt: Date | null;
  accessTokenExpiresAt: Date;
  consent?: { status: JourneyConsentStatus } | null;
  inviteeUser?: { name: string | null; email: string } | null;
};

export type JourneyMemberMeetingParticipant = {
  id: string;
  governedJourneyInvitationId: string;
  status: "AUTHORIZED" | "REMOVED";
};

export type JourneyMemberCandidate = {
  key: string;
  canonicalUserId: string | null;
  canonicalInvitationId: string | null;
  sourceInvitationId: string;
  displayName: string;
  eligibility: GovernedParticipantSelectionEligibility;
  existingMeetingParticipantId: string | null;
};

const eligibilityPriority: Record<GovernedParticipantSelectionEligibility, number> = {
  ALREADY_PRESENT: 7,
  ELIGIBLE: 6,
  PENDING_CONSENT: 5,
  DECLINED: 4,
  REVOKED: 3,
  EXPIRED: 2,
  INELIGIBLE: 1,
};

export function classifyJourneyMemberEligibility(
  invitation: JourneyMemberInvitation,
  alreadyPresent: boolean,
  now = new Date(),
): GovernedParticipantSelectionEligibility {
  if (invitation.revokedAt || invitation.status === "REVOKED") return "REVOKED";
  if (invitation.status === "EXPIRED" || invitation.accessTokenExpiresAt <= now) return "EXPIRED";
  if (invitation.consent?.status === "PENDING") return "PENDING_CONSENT";
  if (invitation.consent?.status === "DECLINED") return "DECLINED";
  if (!hasCurrentJourneyAccess(invitation, now)) return "INELIGIBLE";
  return alreadyPresent ? "ALREADY_PRESENT" : "ELIGIBLE";
}

export function projectJourneyMemberCandidates(input: {
  organizer: { id: string; displayName: string };
  invitations: readonly JourneyMemberInvitation[];
  meetingParticipants: readonly JourneyMemberMeetingParticipant[];
  publicNamesByUserId?: ReadonlyMap<string, string>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const invitationsById = new Map(input.invitations.map((invitation) => [invitation.id, invitation]));
  const authorized = input.meetingParticipants.filter((participant) => participant.status === "AUTHORIZED");
  const candidates = new Map<string, JourneyMemberCandidate>();

  const currentInvitations = input.invitations.filter((invitation) =>
    !invitation.revokedAt
    && invitation.status !== "REVOKED"
    && invitation.status !== "EXPIRED"
    && invitation.accessTokenExpiresAt > now
    && invitation.consent?.status !== "DECLINED",
  );

  for (const invitation of currentInvitations) {
    const key = invitation.inviteeUserId ? `user:${invitation.inviteeUserId}` : `guest:${invitation.id}`;
    const existingParticipant = authorized.find((participant) => {
      if (participant.governedJourneyInvitationId === invitation.id) return true;
      if (!invitation.inviteeUserId) return false;
      const participantInvitation = invitationsById.get(participant.governedJourneyInvitationId);
      return participantInvitation?.inviteeUserId === invitation.inviteeUserId && hasCurrentJourneyAccess(participantInvitation, now);
    });
    const eligibility = classifyJourneyMemberEligibility(invitation, Boolean(existingParticipant), now);
    const userDisplayName = invitation.inviteeUserId
      ? input.publicNamesByUserId?.get(invitation.inviteeUserId)
        ?? (invitation.inviteeUserId === input.organizer.id ? input.organizer.displayName : null)
        ?? invitation.inviteeUser?.name
        ?? invitation.inviteeUser?.email
      : null;
    const candidate: JourneyMemberCandidate = {
      key,
      canonicalUserId: invitation.inviteeUserId,
      canonicalInvitationId: invitation.inviteeUserId ? null : invitation.id,
      sourceInvitationId: invitation.id,
      displayName: userDisplayName ?? invitation.displayName,
      eligibility,
      existingMeetingParticipantId: existingParticipant?.id ?? null,
    };
    const current = candidates.get(key);
    if (!current || eligibilityPriority[candidate.eligibility] > eligibilityPriority[current.eligibility]) {
      candidates.set(key, candidate);
    }
  }

  return [...candidates.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "fr", { sensitivity: "base" }) || left.key.localeCompare(right.key),
  );
}

export function formatMeetingSelectionResultCount(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count > 1 ? plural : singular}`;
}

export function isJourneyMemberSelectable(eligibility: GovernedParticipantSelectionEligibility) {
  return eligibility === "ELIGIBLE" || eligibility === "ALREADY_PRESENT";
}

export function summarizeJourneyMemberSelection(
  items: ReadonlyArray<{ decision: "UNDECIDED" | "INCLUDED" | "EXCLUDED"; observedEligibility: GovernedParticipantSelectionEligibility }>,
) {
  const retained = items.filter((item) => item.decision === "INCLUDED");
  return {
    observed: items.length,
    retained: retained.length,
    excluded: items.filter((item) => item.decision === "EXCLUDED").length,
    toAdd: retained.filter((item) => item.observedEligibility === "ELIGIBLE").length,
    alreadyPresent: retained.filter((item) => item.observedEligibility === "ALREADY_PRESENT").length,
  };
}
