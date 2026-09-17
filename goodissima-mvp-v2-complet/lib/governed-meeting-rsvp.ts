import type {
  CommunicationSessionStatus,
  GovernedMeetingParticipantStatus,
  MeetingRsvpStatus,
  Prisma,
} from "@prisma/client";
import { hasCurrentJourneyAccess } from "@/lib/governed-journey-consent";

export type MeetingRsvpProjection = MeetingRsvpStatus | "LEGACY_UNKNOWN";
export type MeetingRsvpActor =
  | { kind: "AUTHENTICATED_USER"; userId: string }
  | { kind: "INVITATION_GUEST"; invitationId: string };

export function meetingRsvpActorMatchesInvitation(
  actor: MeetingRsvpActor,
  invitation: { id: string; inviteeUserId: string | null },
) {
  return invitation.inviteeUserId
    ? actor.kind === "AUTHENTICATED_USER" &&
        actor.userId === invitation.inviteeUserId
    : actor.kind === "INVITATION_GUEST" && actor.invitationId === invitation.id;
}

export function projectMeetingRsvp(
  rsvp: { status: MeetingRsvpStatus } | null | undefined,
): MeetingRsvpProjection {
  return rsvp?.status ?? "LEGACY_UNKNOWN";
}

export function meetingRsvpLabel(
  rsvp: { status: MeetingRsvpStatus } | null | undefined,
) {
  return (
    {
      PENDING: "Invitation en attente",
      ACCEPTED: "Participation acceptée",
      DECLINED: "Participation déclinée",
      LEGACY_UNKNOWN: "Participation historique — réponse non enregistrée",
    } as const
  )[projectMeetingRsvp(rsvp)];
}

type AccessParticipant = {
  status: GovernedMeetingParticipantStatus;
  rsvp?: { status: MeetingRsvpStatus; meetingRevision: number } | null;
  communicationSession: {
    rsvpRevision: number;
    status: CommunicationSessionStatus;
    accessOpened: boolean;
    expiresAt: Date | null;
  };
};

export function hasCurrentMeetingMediaAccess(
  participant: AccessParticipant,
  now = new Date(),
) {
  if (participant.status !== "AUTHORIZED") return false;
  const session = participant.communicationSession;
  if (
    !session.accessOpened ||
    session.status !== "REQUESTED" ||
    (session.expiresAt && session.expiresAt <= now)
  )
    return false;
  // Compatibility is deliberately limited to historical rows created before the RSVP flow.
  if (!participant.rsvp) return true;
  return (
    participant.rsvp.status === "ACCEPTED" &&
    participant.rsvp.meetingRevision === session.rsvpRevision
  );
}

export async function createPendingMeetingRsvp(
  tx: Prisma.TransactionClient,
  input: {
    meetingParticipantId: string;
    meetingRevision: number;
    actorUserId: string;
  },
) {
  const rsvp = await tx.governedMeetingRsvp.create({
    data: {
      meetingParticipantId: input.meetingParticipantId,
      status: "PENDING",
      meetingRevision: input.meetingRevision,
    },
  });
  await tx.governedMeetingRsvpEvent.create({
    data: {
      meetingParticipantId: input.meetingParticipantId,
      rsvpId: rsvp.id,
      type: "INVITED",
      actorUserId: input.actorUserId,
      actorKind: "ORGANIZER",
      rsvpVersion: rsvp.version,
      meetingRevision: input.meetingRevision,
    },
  });
  return rsvp;
}

export async function decideMeetingRsvpInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    meetingParticipantId: string;
    invitationId: string;
    actor: MeetingRsvpActor;
    decision: "ACCEPTED" | "DECLINED";
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const participant = await tx.governedMeetingParticipant.findUnique({
    where: { id: input.meetingParticipantId },
    include: {
      rsvp: true,
      communicationSession: true,
      governedJourneyInvitation: { include: { consent: true } },
    },
  });
  if (
    !participant ||
    participant.governedJourneyInvitationId !== input.invitationId ||
    participant.status !== "AUTHORIZED"
  )
    throw new Error("Réponse à la réunion indisponible.");
  const invitation = participant.governedJourneyInvitation;
  const session = participant.communicationSession;
  if (
    !meetingRsvpActorMatchesInvitation(input.actor, invitation) ||
    !hasCurrentJourneyAccess(invitation) ||
    invitation.ownerId !== session.ownerId ||
    invitation.relationTemplateId !== session.relationTemplateId ||
    session.relationCaseId !== null
  )
    throw new Error("Réponse à la réunion indisponible.");
  if (
    session.status === "CANCELLED" ||
    session.status === "COMPLETED" ||
    (session.expiresAt && session.expiresAt <= now)
  )
    throw new Error("Réponse à la réunion indisponible.");
  if (
    !participant.rsvp ||
    participant.rsvp.meetingRevision !== session.rsvpRevision
  )
    throw new Error("Une nouvelle réponse est requise.");
  const actorUserId =
    input.actor.kind === "AUTHENTICATED_USER" ? input.actor.userId : null;
  if (
    participant.rsvp.status === input.decision &&
    participant.rsvp.decidedByUserId === actorUserId
  )
    return { changed: false, rsvp: participant.rsvp };
  if (participant.rsvp.status !== "PENDING")
    throw new Error("Cette invitation a déjà reçu une réponse.");
  const updated = await tx.governedMeetingRsvp.updateMany({
    where: {
      id: participant.rsvp.id,
      status: "PENDING",
      version: participant.rsvp.version,
      meetingRevision: session.rsvpRevision,
    },
    data: {
      status: input.decision,
      decidedAt: now,
      decidedByUserId: actorUserId,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    const current = await tx.governedMeetingRsvp.findUnique({
      where: { id: participant.rsvp.id },
    });
    if (
      current?.status === input.decision &&
      current.decidedByUserId === actorUserId
    )
      return { changed: false, rsvp: current };
    throw new Error("Cette invitation a déjà reçu une réponse.");
  }
  const rsvp = await tx.governedMeetingRsvp.findUniqueOrThrow({
    where: { id: participant.rsvp.id },
  });
  await tx.governedMeetingRsvpEvent.create({
    data: {
      meetingParticipantId: participant.id,
      rsvpId: rsvp.id,
      type: input.decision,
      actorUserId,
      actorKind: "INVITEE",
      rsvpVersion: rsvp.version,
      meetingRevision: rsvp.meetingRevision,
    },
  });
  return { changed: true, rsvp };
}
