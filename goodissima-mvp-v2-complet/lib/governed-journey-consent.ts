import type { GovernedJourneyConsent, GovernedJourneyInvitation, PrismaClient } from "@prisma/client";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";

type ConsentAwareInvitation = GovernedJourneyInvitation & { consent?: GovernedJourneyConsent | null };

export type JourneyConsentProjection = "NEW_CONSENT_FLOW" | "LEGACY_UNKNOWN";
export type JourneyParticipationState = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "LEGACY_UNKNOWN";

export function projectJourneyConsent(invitation: ConsentAwareInvitation): JourneyConsentProjection {
  return invitation.consent ? "NEW_CONSENT_FLOW" : "LEGACY_UNKNOWN";
}

export function projectJourneyParticipationState(invitation: ConsentAwareInvitation): JourneyParticipationState {
  if (invitation.status === "REVOKED" || invitation.revokedAt) return "REVOKED";
  return invitation.consent?.status ?? "LEGACY_UNKNOWN";
}

export function hasCurrentJourneyAccess(invitation: ConsentAwareInvitation, now = new Date()) {
  if (invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.accessTokenExpiresAt <= now) return false;
  return projectJourneyConsent(invitation) === "LEGACY_UNKNOWN" || invitation.consent?.status === "ACCEPTED";
}

type DecisionClient = Pick<PrismaClient, "$transaction">;

export async function decideJourneyInvitation(
  client: DecisionClient,
  input: { token: string; userId: string | null; decision: "ACCEPTED" | "DECLINED"; now?: Date },
) {
  const now = input.now ?? new Date();
  const tokenHash = hashJourneyInvitationToken(input.token);

  return client.$transaction(async (tx) => {
    const invitation = await tx.governedJourneyInvitation.findUnique({
      where: { accessTokenHash: tokenHash },
      include: { consent: true },
    });
    if (!invitation || !invitation.consent) throw new Error("Invitation indisponible.");
    if (invitation.revokedAt || invitation.status === "REVOKED" || invitation.accessTokenExpiresAt <= now) {
      throw new Error("Invitation indisponible.");
    }
    // A personal link proves possession of this scoped invitation, not identity.
    const actorUserId = invitation.inviteeUserId ? input.userId : null;
    if (invitation.inviteeUserId && invitation.inviteeUserId !== actorUserId) throw new Error("Invitation indisponible.");

    if (invitation.consent.status !== "PENDING") {
      if (invitation.consent.status === input.decision && invitation.consent.decidedByUserId === actorUserId) {
        return { invitation, consent: invitation.consent, changed: false };
      }
      throw new Error("Une décision a déjà été enregistrée.");
    }

    const nextVersion = invitation.consent.version + 1;
    const transition = await tx.governedJourneyConsent.updateMany({
      where: { id: invitation.consent.id, status: "PENDING", version: invitation.consent.version },
      data: { status: input.decision, decidedAt: now, decidedByUserId: actorUserId, version: nextVersion },
    });
    if (transition.count !== 1) {
      const current = await tx.governedJourneyConsent.findUnique({ where: { id: invitation.consent.id } });
      if (current?.status === input.decision && current.decidedByUserId === actorUserId) {
        return { invitation, consent: current, changed: false };
      }
      throw new Error("Une décision a déjà été enregistrée.");
    }

    if (input.decision === "ACCEPTED") {
      const activation = await tx.governedJourneyInvitation.updateMany({
        where: { id: invitation.id, status: "PREPARED", revokedAt: null, accessTokenExpiresAt: { gt: now } },
        data: { status: "ACTIVE" },
      });
      if (activation.count !== 1) throw new Error("Invitation indisponible.");
    }

    await tx.governedJourneyConsentEvent.create({
      data: {
        invitationId: invitation.id,
        consentId: invitation.consent.id,
        type: input.decision,
        actorUserId,
        actorKind: "INVITEE",
        occurredAt: now,
        consentVersion: nextVersion,
        roleSnapshot: invitation.role,
      },
    });
    return { invitation, consent: { ...invitation.consent, status: input.decision, version: nextVersion }, changed: true };
  });
}

export async function decideReceivedJourneyInvitation(
  client: DecisionClient,
  input: { invitationId: string; userId: string; decision: "ACCEPTED" | "DECLINED"; now?: Date },
) {
  const now = input.now ?? new Date();
  return client.$transaction(async (tx) => {
    const invitation = await tx.governedJourneyInvitation.findFirst({
      where: { id: input.invitationId, inviteeUserId: input.userId },
      include: { consent: true },
    });
    if (!invitation || !invitation.consent || invitation.revokedAt || invitation.status === "REVOKED" || invitation.accessTokenExpiresAt <= now) throw new Error("Invitation indisponible.");
    if (invitation.consent.status !== "PENDING") {
      if (invitation.consent.status === input.decision && invitation.consent.decidedByUserId === input.userId) return { changed: false, consent: invitation.consent };
      throw new Error("Une décision a déjà été enregistrée.");
    }
    const nextVersion = invitation.consent.version + 1;
    const transition = await tx.governedJourneyConsent.updateMany({ where: { id: invitation.consent.id, status: "PENDING", version: invitation.consent.version }, data: { status: input.decision, decidedAt: now, decidedByUserId: input.userId, version: nextVersion } });
    if (transition.count !== 1) {
      const current = await tx.governedJourneyConsent.findUnique({ where: { id: invitation.consent.id } });
      if (current?.status === input.decision && current.decidedByUserId === input.userId) return { changed: false, consent: current };
      throw new Error("Une décision a déjà été enregistrée.");
    }
    if (input.decision === "ACCEPTED") {
      const activation = await tx.governedJourneyInvitation.updateMany({ where: { id: invitation.id, status: "PREPARED", revokedAt: null, accessTokenExpiresAt: { gt: now } }, data: { status: "ACTIVE" } });
      if (activation.count !== 1) throw new Error("Invitation indisponible.");
    }
    await tx.governedJourneyConsentEvent.create({ data: { invitationId: invitation.id, consentId: invitation.consent.id, type: input.decision, actorUserId: input.userId, actorKind: "INVITEE", occurredAt: now, consentVersion: nextVersion, roleSnapshot: invitation.role } });
    return { changed: true, consent: { ...invitation.consent, status: input.decision, version: nextVersion } };
  });
}
