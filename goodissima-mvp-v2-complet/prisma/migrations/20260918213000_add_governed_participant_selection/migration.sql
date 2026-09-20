CREATE TYPE "GovernedParticipantSelectionSource" AS ENUM ('JOURNEY_MEMBERS', 'DIRECTORY', 'MATCHING', 'MEETING_HISTORY');
CREATE TYPE "GovernedParticipantSelectionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'VALIDATED', 'MATERIALIZED', 'FAILED', 'CANCELLED');
CREATE TYPE "GovernedParticipantSelectionEligibility" AS ENUM ('ELIGIBLE', 'ALREADY_PRESENT', 'PENDING_CONSENT', 'DECLINED', 'REVOKED', 'EXPIRED', 'INELIGIBLE');
CREATE TYPE "GovernedParticipantSelectionDecision" AS ENUM ('UNDECIDED', 'INCLUDED', 'EXCLUDED');
CREATE TYPE "GovernedParticipantSelectionEventType" AS ENUM ('CREATED', 'REVIEW_STARTED', 'VALIDATED', 'MATERIALIZED', 'FAILED', 'CANCELLED');

CREATE UNIQUE INDEX "CommunicationSession_selection_scope_key"
  ON "CommunicationSession"("id", "ownerId", "relationTemplateId");

CREATE UNIQUE INDEX "GovernedMeetingParticipant_selection_scope_key"
  ON "GovernedMeetingParticipant"("id", "communicationSessionId");

CREATE TABLE "GovernedParticipantSelection" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "governedJourneyId" TEXT NOT NULL,
  "relationTemplateId" TEXT NOT NULL,
  "communicationSessionId" TEXT NOT NULL,
  "source" "GovernedParticipantSelectionSource" NOT NULL,
  "status" "GovernedParticipantSelectionStatus" NOT NULL DEFAULT 'DRAFT',
  "criteria" JSONB NOT NULL,
  "materializationSummary" JSONB,
  "createdByUserId" TEXT NOT NULL,
  "validatedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewStartedAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "materializedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "GovernedParticipantSelection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedParticipantSelection_version_check" CHECK ("version" >= 0),
  CONSTRAINT "GovernedParticipantSelection_criteria_object_check" CHECK (jsonb_typeof("criteria") = 'object'),
  CONSTRAINT "GovernedParticipantSelection_summary_object_check" CHECK ("materializationSummary" IS NULL OR jsonb_typeof("materializationSummary") = 'object'),
  CONSTRAINT "GovernedParticipantSelection_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "reviewStartedAt" IS NULL AND "validatedAt" IS NULL AND "validatedByUserId" IS NULL AND "materializedAt" IS NULL AND "failedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'UNDER_REVIEW' AND "reviewStartedAt" IS NOT NULL AND "validatedAt" IS NULL AND "validatedByUserId" IS NULL AND "materializedAt" IS NULL AND "failedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'VALIDATED' AND "reviewStartedAt" IS NOT NULL AND "validatedAt" IS NOT NULL AND "validatedByUserId" IS NOT NULL AND "materializedAt" IS NULL AND "failedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'MATERIALIZED' AND "reviewStartedAt" IS NOT NULL AND "validatedAt" IS NOT NULL AND "validatedByUserId" IS NOT NULL AND "materializedAt" IS NOT NULL AND "failedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'FAILED' AND "reviewStartedAt" IS NOT NULL AND "validatedAt" IS NOT NULL AND "validatedByUserId" IS NOT NULL AND "materializedAt" IS NULL AND "failedAt" IS NOT NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "materializedAt" IS NULL AND "failedAt" IS NULL AND "cancelledAt" IS NOT NULL)
  )
);

CREATE TABLE "GovernedParticipantSelectionItem" (
  "id" TEXT NOT NULL,
  "selectionId" TEXT NOT NULL,
  "communicationSessionId" TEXT NOT NULL,
  "relationTemplateId" TEXT NOT NULL,
  "canonicalUserId" TEXT,
  "canonicalInvitationId" TEXT,
  "canonicalDirectoryProfileId" TEXT,
  "sourceInvitationId" TEXT,
  "sourceDirectoryProfileId" TEXT,
  "sourceMatchingResultId" TEXT,
  "sourceMeetingParticipantId" TEXT,
  "snapshotDisplayName" TEXT NOT NULL,
  "observedEligibility" "GovernedParticipantSelectionEligibility" NOT NULL,
  "decision" "GovernedParticipantSelectionDecision" NOT NULL DEFAULT 'UNDECIDED',
  "decisionReason" TEXT,
  "materializedMeetingParticipantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "GovernedParticipantSelectionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedParticipantSelectionItem_canonical_identity_xor_check" CHECK (
    num_nonnulls("canonicalUserId", "canonicalInvitationId", "canonicalDirectoryProfileId") = 1
  ),
  CONSTRAINT "GovernedParticipantSelectionItem_provenance_check" CHECK (
    num_nonnulls("sourceInvitationId", "sourceDirectoryProfileId", "sourceMatchingResultId", "sourceMeetingParticipantId") <= 1
  ),
  CONSTRAINT "GovernedParticipantSelectionItem_decision_check" CHECK (
    ("decision" = 'UNDECIDED' AND "decidedAt" IS NULL AND "decisionReason" IS NULL)
    OR ("decision" IN ('INCLUDED', 'EXCLUDED') AND "decidedAt" IS NOT NULL)
  )
);

CREATE TABLE "GovernedParticipantSelectionEvent" (
  "id" TEXT NOT NULL,
  "selectionId" TEXT NOT NULL,
  "type" "GovernedParticipantSelectionEventType" NOT NULL,
  "actorUserId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedParticipantSelectionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedParticipantSelectionEvent_version_check" CHECK ("version" >= 0),
  CONSTRAINT "GovernedParticipantSelectionEvent_summary_object_check" CHECK ("summary" IS NULL OR jsonb_typeof("summary") = 'object')
);

CREATE UNIQUE INDEX "GovernedParticipantSelection_item_scope_key"
  ON "GovernedParticipantSelection"("id", "communicationSessionId", "relationTemplateId");
CREATE INDEX "GovernedParticipantSelection_scope_idx"
  ON "GovernedParticipantSelection"("ownerId", "governedJourneyId", "communicationSessionId");
CREATE INDEX "GovernedParticipantSelection_ownerId_status_createdAt_idx"
  ON "GovernedParticipantSelection"("ownerId", "status", "createdAt");
CREATE INDEX "GovernedParticipantSelection_governedJourneyId_status_createdAt_idx"
  ON "GovernedParticipantSelection"("governedJourneyId", "status", "createdAt");
CREATE INDEX "GovernedParticipantSelection_communicationSessionId_status_createdAt_idx"
  ON "GovernedParticipantSelection"("communicationSessionId", "status", "createdAt");

CREATE UNIQUE INDEX "GovernedParticipantSelectionItem_materializedMeetingParticipantId_key"
  ON "GovernedParticipantSelectionItem"("materializedMeetingParticipantId");
CREATE UNIQUE INDEX "GovernedParticipantSelectionItem_selection_user_key"
  ON "GovernedParticipantSelectionItem"("selectionId", "canonicalUserId") WHERE "canonicalUserId" IS NOT NULL;
CREATE UNIQUE INDEX "GovernedParticipantSelectionItem_selection_invitation_key"
  ON "GovernedParticipantSelectionItem"("selectionId", "canonicalInvitationId") WHERE "canonicalInvitationId" IS NOT NULL;
CREATE UNIQUE INDEX "GovernedParticipantSelectionItem_selection_directory_key"
  ON "GovernedParticipantSelectionItem"("selectionId", "canonicalDirectoryProfileId") WHERE "canonicalDirectoryProfileId" IS NOT NULL;
CREATE INDEX "GovernedParticipantSelectionItem_selectionId_decision_idx"
  ON "GovernedParticipantSelectionItem"("selectionId", "decision");
CREATE INDEX "GovernedParticipantSelectionItem_selectionId_observedEligibility_idx"
  ON "GovernedParticipantSelectionItem"("selectionId", "observedEligibility");
CREATE INDEX "GovernedParticipantSelectionItem_canonicalUserId_idx" ON "GovernedParticipantSelectionItem"("canonicalUserId");
CREATE INDEX "GovernedParticipantSelectionItem_canonicalInvitationId_idx" ON "GovernedParticipantSelectionItem"("canonicalInvitationId");
CREATE INDEX "GovernedParticipantSelectionItem_canonicalDirectoryProfileId_idx" ON "GovernedParticipantSelectionItem"("canonicalDirectoryProfileId");
CREATE INDEX "GovernedParticipantSelectionItem_sourceInvitationId_idx" ON "GovernedParticipantSelectionItem"("sourceInvitationId");
CREATE INDEX "GovernedParticipantSelectionItem_sourceDirectoryProfileId_idx" ON "GovernedParticipantSelectionItem"("sourceDirectoryProfileId");
CREATE INDEX "GovernedParticipantSelectionItem_sourceMatchingResultId_idx" ON "GovernedParticipantSelectionItem"("sourceMatchingResultId");
CREATE INDEX "GovernedParticipantSelectionItem_sourceMeetingParticipantId_idx" ON "GovernedParticipantSelectionItem"("sourceMeetingParticipantId");

CREATE INDEX "GovernedParticipantSelectionEvent_selectionId_occurredAt_id_idx"
  ON "GovernedParticipantSelectionEvent"("selectionId", "occurredAt", "id");
CREATE INDEX "GovernedParticipantSelectionEvent_actorUserId_occurredAt_idx"
  ON "GovernedParticipantSelectionEvent"("actorUserId", "occurredAt");

ALTER TABLE "GovernedParticipantSelection" ADD CONSTRAINT "GovernedParticipantSelection_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelection" ADD CONSTRAINT "GovernedParticipantSelection_journey_fkey"
  FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelection" ADD CONSTRAINT "GovernedParticipantSelection_session_fkey"
  FOREIGN KEY ("communicationSessionId", "ownerId", "relationTemplateId") REFERENCES "CommunicationSession"("id", "ownerId", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelection" ADD CONSTRAINT "GovernedParticipantSelection_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelection" ADD CONSTRAINT "GovernedParticipantSelection_validatedByUserId_fkey"
  FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_selection_fkey"
  FOREIGN KEY ("selectionId", "communicationSessionId", "relationTemplateId") REFERENCES "GovernedParticipantSelection"("id", "communicationSessionId", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_canonicalUserId_fkey"
  FOREIGN KEY ("canonicalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_canonical_invitation_fkey"
  FOREIGN KEY ("canonicalInvitationId", "relationTemplateId") REFERENCES "GovernedJourneyInvitation"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_canonicalDirectoryProfileId_fkey"
  FOREIGN KEY ("canonicalDirectoryProfileId") REFERENCES "DirectoryProfile"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_source_invitation_fkey"
  FOREIGN KEY ("sourceInvitationId", "relationTemplateId") REFERENCES "GovernedJourneyInvitation"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_sourceDirectoryProfileId_fkey"
  FOREIGN KEY ("sourceDirectoryProfileId") REFERENCES "DirectoryProfile"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_sourceMatchingResultId_fkey"
  FOREIGN KEY ("sourceMatchingResultId") REFERENCES "MatchingResult"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_source_participant_fkey"
  FOREIGN KEY ("sourceMeetingParticipantId", "communicationSessionId") REFERENCES "GovernedMeetingParticipant"("id", "communicationSessionId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionItem" ADD CONSTRAINT "GovernedParticipantSelectionItem_materialized_participant_fkey"
  FOREIGN KEY ("materializedMeetingParticipantId", "communicationSessionId") REFERENCES "GovernedMeetingParticipant"("id", "communicationSessionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedParticipantSelectionEvent" ADD CONSTRAINT "GovernedParticipantSelectionEvent_selectionId_fkey"
  FOREIGN KEY ("selectionId") REFERENCES "GovernedParticipantSelection"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedParticipantSelectionEvent" ADD CONSTRAINT "GovernedParticipantSelectionEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION reject_governed_participant_selection_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'GovernedParticipantSelectionEvent is append-only';
END;
$$;

CREATE TRIGGER "GovernedParticipantSelectionEvent_append_only"
BEFORE UPDATE OR DELETE ON "GovernedParticipantSelectionEvent"
FOR EACH ROW EXECUTE FUNCTION reject_governed_participant_selection_event_mutation();
