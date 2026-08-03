ALTER TABLE "GovernedMemorySource"
  ADD COLUMN "governedJourneyId" TEXT,
  ADD COLUMN "governedJourneyEventId" TEXT;

ALTER TABLE "GovernedMemorySource"
  ADD CONSTRAINT "GovernedMemorySource_journey_event_requires_journey_check"
  CHECK ("governedJourneyEventId" IS NULL OR "governedJourneyId" IS NOT NULL);

CREATE UNIQUE INDEX "GovernedJourneyEvent_id_governedJourneyId_relationCaseId_key"
  ON "GovernedJourneyEvent"("id", "governedJourneyId", "relationCaseId");

CREATE INDEX "GovernedMemorySource_relationCaseId_governedJourneyId_recordedAt_id_idx"
  ON "GovernedMemorySource"("relationCaseId", "governedJourneyId", "recordedAt", "id");

CREATE INDEX "GovernedMemorySource_relationCaseId_governedJourneyEventId_idx"
  ON "GovernedMemorySource"("relationCaseId", "governedJourneyEventId");

ALTER TABLE "GovernedMemorySource"
  ADD CONSTRAINT "GovernedMemorySource_governedJourneyId_relationCaseId_fkey"
  FOREIGN KEY ("governedJourneyId", "relationCaseId")
  REFERENCES "GovernedJourney"("id", "relationCaseId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedMemorySource"
  ADD CONSTRAINT "GovernedMemorySource_governedJourneyEventId_governedJourneyId_relationCaseId_fkey"
  FOREIGN KEY ("governedJourneyEventId", "governedJourneyId", "relationCaseId")
  REFERENCES "GovernedJourneyEvent"("id", "governedJourneyId", "relationCaseId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
