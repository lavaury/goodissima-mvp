"use client";

import { useRouter } from "next/navigation";
import {
  GoodissimaMediaRoom,
  type MediaRoomExpectedPerson,
} from "@/components/media/GoodissimaMediaRoom";

type ActorKind = "owner" | "candidate" | "guest";
export type ExpectedMeetingParticipant = MediaRoomExpectedPerson;

export function RelationLiveKitMediaRoom({
  caseId,
  contextKind = "relationCase",
  governedJourneyId,
  actorKind,
  available,
  candidateAccessToken,
  guestAccessToken,
  preferredSessionId,
  joinLabel,
  returnHref,
  expectedParticipants = [],
}: {
  caseId?: string;
  contextKind?: "relationCase" | "governedJourney";
  governedJourneyId?: string;
  actorKind: ActorKind;
  available: boolean;
  candidateAccessToken?: string;
  guestAccessToken?: string;
  preferredSessionId?: string;
  joinLabel?: string;
  returnHref?: string;
  expectedParticipants?: ExpectedMeetingParticipant[];
}) {
  const router = useRouter();
  const journey = contextKind === "governedJourney";
  const root = journey
    ? actorKind === "guest"
      ? `/api/gouvernance/invitations/${guestAccessToken}/media`
      : `/api/gouvernance/parcours/${governedJourneyId}/media`
    : actorKind === "candidate"
      ? `/api/candidate/cases/${caseId}/media`
      : `/api/cases/${caseId}/media`;
  const tokenEndpoint = journey
    ? `${root}/livekit-token`
    : actorKind === "owner"
      ? `${root}/protected-call`
      : `${root}/livekit-token`;

  return (
    <div
      data-boussole-id={
        journey ? "governed-journey-media-room" : "case-secure-media-room"
      }
    >
      <GoodissimaMediaRoom
        capabilities={{
          canJoin: available,
          canEnd: actorKind === "owner",
          tokenEndpoint,
          tokenBody: { preferredSessionId, candidateAccessToken },
          usageEndpoint: `${root}/session-usage`,
          attendanceEndpoint:
            journey && actorKind !== "candidate"
              ? `${root}/attendance`
              : undefined,
          endEndpoint:
            actorKind === "owner"
              ? journey
                ? `${root}/end`
                : `${root}/protected-call/end`
              : undefined,
          returnHref,
        }}
        expectedPeople={expectedParticipants}
        joinLabel={joinLabel}
        onEnded={returnHref ? () => { router.replace(returnHref); router.refresh(); } : undefined}
      />
    </div>
  );
}
