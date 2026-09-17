"use server";

import { redirect } from "next/navigation";
import {
  decideMeetingRsvpInTransaction,
  type MeetingRsvpActor,
} from "@/lib/governed-meeting-rsvp";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { invitationIdentityMatches } from "@/lib/governed-journey-invitation-identity";
import { prisma } from "@/lib/prisma";

async function decide(formData: FormData, decision: "ACCEPTED" | "DECLINED") {
  const token = String(formData.get("invitationToken") ?? "");
  const meetingParticipantId = String(
    formData.get("meetingParticipantId") ?? "",
  );
  const invitation = token
    ? await prisma.governedJourneyInvitation.findFirst({
        where: {
          accessTokenHash: hashJourneyInvitationToken(token),
          status: "ACTIVE",
          revokedAt: null,
          accessTokenExpiresAt: { gt: new Date() },
        },
        select: { id: true, inviteeUserId: true },
      })
    : null;
  if (!invitation || !meetingParticipantId)
    throw new Error("Réponse à la réunion indisponible.");
  let actor: MeetingRsvpActor;
  if (invitation.inviteeUserId) {
    if (!(await invitationIdentityMatches(invitation.inviteeUserId)))
      throw new Error("Réponse à la réunion indisponible.");
    actor = { kind: "AUTHENTICATED_USER", userId: invitation.inviteeUserId };
  } else {
    actor = { kind: "INVITATION_GUEST", invitationId: invitation.id };
  }
  await prisma.$transaction((tx) =>
    decideMeetingRsvpInTransaction(tx, {
      meetingParticipantId,
      invitationId: invitation.id,
      actor,
      decision,
    }),
  );
  redirect(
    `/gouvernance/invitation/${token}?meetingDecision=${decision.toLowerCase()}`,
  );
}

export async function acceptMeetingRsvp(formData: FormData) {
  return decide(formData, "ACCEPTED");
}
export async function declineMeetingRsvp(formData: FormData) {
  return decide(formData, "DECLINED");
}
