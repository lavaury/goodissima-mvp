import Link from "next/link";
import { notFound } from "next/navigation";
import { RelationLiveKitMediaRoom } from "@/components/RelationLiveKitMediaRoom";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { invitationIdentityMatches } from "@/lib/governed-journey-invitation-identity";
import { hasCurrentJourneyAccess } from "@/lib/governed-journey-consent";
import { hasCurrentMeetingMediaAccess } from "@/lib/governed-meeting-rsvp";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GuestMeetingRoomPage({
  params,
}: {
  params: { token: string; meetingId: string };
}) {
  const invitation = await prisma.governedJourneyInvitation.findUnique({
    where: { accessTokenHash: hashJourneyInvitationToken(params.token) },
    include: { consent: true },
  });
  if (!invitation || !hasCurrentJourneyAccess(invitation)) notFound();
  if (
    invitation.consent &&
    !(await invitationIdentityMatches(invitation.inviteeUserId))
  )
    notFound();
  const authorization = await prisma.governedMeetingParticipant.findFirst({
    where: {
      communicationSessionId: params.meetingId,
      governedJourneyInvitationId: invitation.id,
      status: "AUTHORIZED",
    },
    include: { rsvp: true, communicationSession: true },
  });
  const available = Boolean(
    authorization && hasCurrentMeetingMediaAccess(authorization),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link
        href={`/gouvernance/invitation/${params.token}`}
        className="inline-flex min-h-11 items-center font-semibold text-[#247f88] underline underline-offset-4"
      >
        ← Retour au Parcours
      </Link>
      <div className="mt-4">
        <RelationLiveKitMediaRoom
          contextKind="governedJourney"
          governedJourneyId={invitation.relationTemplateId}
          actorKind="guest"
          available={available}
          guestAccessToken={params.token}
          preferredSessionId={params.meetingId}
          joinLabel="Rejoindre la réunion"
        />
      </div>
    </div>
  );
}
