CREATE TYPE "GovernedMeetingParticipantStatus" AS ENUM ('AUTHORIZED', 'REMOVED');

CREATE TABLE "GovernedMeetingParticipant" (
  "id" TEXT NOT NULL,
  "communicationSessionId" TEXT NOT NULL,
  "governedJourneyInvitationId" TEXT NOT NULL,
  "status" "GovernedMeetingParticipantStatus" NOT NULL DEFAULT 'AUTHORIZED',
  "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "authorizedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedMeetingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernedMeetingParticipant_communicationSessionId_governedJourneyInvitationId_key" ON "GovernedMeetingParticipant"("communicationSessionId", "governedJourneyInvitationId");
CREATE INDEX "GovernedMeetingParticipant_governedJourneyInvitationId_status_idx" ON "GovernedMeetingParticipant"("governedJourneyInvitationId", "status");
ALTER TABLE "GovernedMeetingParticipant" ADD CONSTRAINT "GovernedMeetingParticipant_communicationSessionId_fkey" FOREIGN KEY ("communicationSessionId") REFERENCES "CommunicationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernedMeetingParticipant" ADD CONSTRAINT "GovernedMeetingParticipant_governedJourneyInvitationId_fkey" FOREIGN KEY ("governedJourneyInvitationId") REFERENCES "GovernedJourneyInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernedMeetingParticipant" ADD CONSTRAINT "GovernedMeetingParticipant_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
