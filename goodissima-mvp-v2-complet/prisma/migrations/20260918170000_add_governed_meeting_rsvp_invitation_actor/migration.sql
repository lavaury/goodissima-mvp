ALTER TABLE "GovernedMeetingRsvp"
  ADD COLUMN "decidedByInvitationId" TEXT;

ALTER TABLE "GovernedMeetingRsvpEvent"
  ADD COLUMN "actorInvitationId" TEXT;

ALTER TABLE "GovernedMeetingRsvp"
  ADD CONSTRAINT "GovernedMeetingRsvp_decidedByInvitationId_fkey"
  FOREIGN KEY ("decidedByInvitationId") REFERENCES "GovernedJourneyInvitation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GovernedMeetingRsvpEvent"
  ADD CONSTRAINT "GovernedMeetingRsvpEvent_actorInvitationId_fkey"
  FOREIGN KEY ("actorInvitationId") REFERENCES "GovernedJourneyInvitation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GovernedMeetingRsvp"
  DROP CONSTRAINT "GovernedMeetingRsvp_decision_check";

ALTER TABLE "GovernedMeetingRsvp"
  ADD CONSTRAINT "GovernedMeetingRsvp_decision_check" CHECK (
    (
      "status" = 'PENDING'
      AND "decidedAt" IS NULL
      AND "decidedByUserId" IS NULL
      AND "decidedByInvitationId" IS NULL
    )
    OR
    (
      "status" IN ('ACCEPTED', 'DECLINED')
      AND "decidedAt" IS NOT NULL
      AND (
        ("decidedByUserId" IS NOT NULL AND "decidedByInvitationId" IS NULL)
        OR
        ("decidedByUserId" IS NULL AND "decidedByInvitationId" IS NOT NULL)
      )
    )
  );
