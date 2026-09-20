CREATE TYPE "MeetingRsvpStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE "GovernedMeetingRsvpEventType" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'RESET_TO_PENDING', 'MEETING_CANCELLED');
CREATE TYPE "GovernedMeetingRsvpActorKind" AS ENUM ('INVITEE', 'ORGANIZER', 'SYSTEM');

ALTER TABLE "CommunicationSession" ADD COLUMN "rsvpRevision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "GovernedMeetingRsvp" (
  "id" TEXT NOT NULL,
  "meetingParticipantId" TEXT NOT NULL,
  "status" "MeetingRsvpStatus" NOT NULL DEFAULT 'PENDING',
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "meetingRevision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedMeetingRsvp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMeetingRsvp_decision_check" CHECK (("status" = 'PENDING' AND "decidedAt" IS NULL AND "decidedByUserId" IS NULL) OR ("status" IN ('ACCEPTED', 'DECLINED') AND "decidedAt" IS NOT NULL AND "decidedByUserId" IS NOT NULL)),
  CONSTRAINT "GovernedMeetingRsvp_meeting_revision_check" CHECK ("meetingRevision" >= 1)
);

CREATE TABLE "GovernedMeetingRsvpEvent" (
  "id" TEXT NOT NULL,
  "meetingParticipantId" TEXT NOT NULL,
  "rsvpId" TEXT,
  "type" "GovernedMeetingRsvpEventType" NOT NULL,
  "actorUserId" TEXT,
  "actorKind" "GovernedMeetingRsvpActorKind" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rsvpVersion" INTEGER,
  "meetingRevision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedMeetingRsvpEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMeetingRsvpEvent_meeting_revision_check" CHECK ("meetingRevision" >= 1)
);

CREATE UNIQUE INDEX "GovernedMeetingRsvp_meetingParticipantId_key" ON "GovernedMeetingRsvp"("meetingParticipantId");
CREATE INDEX "GovernedMeetingRsvp_status_updatedAt_idx" ON "GovernedMeetingRsvp"("status", "updatedAt");
CREATE INDEX "GovernedMeetingRsvp_meetingRevision_status_idx" ON "GovernedMeetingRsvp"("meetingRevision", "status");
CREATE INDEX "GovernedMeetingRsvpEvent_meetingParticipantId_occurredAt_id_idx" ON "GovernedMeetingRsvpEvent"("meetingParticipantId", "occurredAt", "id");
CREATE INDEX "GovernedMeetingRsvpEvent_rsvpId_occurredAt_id_idx" ON "GovernedMeetingRsvpEvent"("rsvpId", "occurredAt", "id");

ALTER TABLE "GovernedMeetingRsvp" ADD CONSTRAINT "GovernedMeetingRsvp_meetingParticipantId_fkey" FOREIGN KEY ("meetingParticipantId") REFERENCES "GovernedMeetingParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMeetingRsvp" ADD CONSTRAINT "GovernedMeetingRsvp_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernedMeetingRsvpEvent" ADD CONSTRAINT "GovernedMeetingRsvpEvent_meetingParticipantId_fkey" FOREIGN KEY ("meetingParticipantId") REFERENCES "GovernedMeetingParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMeetingRsvpEvent" ADD CONSTRAINT "GovernedMeetingRsvpEvent_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "GovernedMeetingRsvp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMeetingRsvpEvent" ADD CONSTRAINT "GovernedMeetingRsvpEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION reject_governed_meeting_rsvp_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'GovernedMeetingRsvpEvent is append-only';
END;
$$;

CREATE TRIGGER "GovernedMeetingRsvpEvent_append_only"
BEFORE UPDATE OR DELETE ON "GovernedMeetingRsvpEvent"
FOR EACH ROW EXECUTE FUNCTION reject_governed_meeting_rsvp_event_mutation();
