"use server";

import { redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { decideMeetingRsvpInTransaction } from "@/lib/governed-meeting-rsvp";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";

async function decide(formData: FormData, decision: "ACCEPTED" | "DECLINED") {
  const token = String(formData.get("invitationToken") ?? "");
  const meetingParticipantId = String(formData.get("meetingParticipantId") ?? "");
  const user = await getCurrentPrismaUser();
  const invitation = await prisma.governedJourneyInvitation.findUnique({ where: { accessTokenHash: hashJourneyInvitationToken(token) }, select: { id: true } });
  if (!invitation || !meetingParticipantId) throw new Error("Réponse à la réunion indisponible.");
  await prisma.$transaction((tx) => decideMeetingRsvpInTransaction(tx, { meetingParticipantId, invitationId: invitation.id, userId: user.id, decision }));
  redirect(`/gouvernance/invitation/${token}?meetingDecision=${decision.toLowerCase()}`);
}

export async function acceptMeetingRsvp(formData: FormData) { return decide(formData, "ACCEPTED"); }
export async function declineMeetingRsvp(formData: FormData) { return decide(formData, "DECLINED"); }
