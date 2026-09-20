ALTER TABLE "GovernedMemoryEvent" ADD COLUMN "relationTemplateId" TEXT;

UPDATE "GovernedMemoryEvent" event
SET "relationTemplateId" = relation_case."templateId"
FROM "RelationCase" relation_case
WHERE event."relationCaseId" = relation_case."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "GovernedMemoryEvent" WHERE "relationTemplateId" IS NULL) THEN
    RAISE EXCEPTION 'GovernedMemoryEvent relationTemplateId backfill incomplete';
  END IF;
END $$;

ALTER TABLE "GovernedMemoryEvent"
  ALTER COLUMN "relationTemplateId" SET NOT NULL,
  ADD COLUMN "governedJourneyId" TEXT,
  ALTER COLUMN "relationCaseId" DROP NOT NULL;

ALTER TABLE "GovernedMemoryEvent" DROP CONSTRAINT "GovernedMemoryEvent_relationCaseId_fkey";

ALTER TABLE "GovernedMemoryEvent"
  ADD CONSTRAINT "GovernedMemoryEvent_scope_check" CHECK ("relationCaseId" IS NOT NULL OR "governedJourneyId" IS NOT NULL),
  ADD CONSTRAINT "GovernedMemoryEvent_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryEvent_relationCaseId_relationTemplateId_fkey" FOREIGN KEY ("relationCaseId", "relationTemplateId") REFERENCES "RelationCase"("id", "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryEvent_governedJourneyId_relationTemplateId_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "GovernedMemoryEvent_relationTemplateId_recordedAt_id_idx" ON "GovernedMemoryEvent"("relationTemplateId", "recordedAt", "id");
CREATE INDEX "GovernedMemoryEvent_governedJourneyId_recordedAt_id_idx" ON "GovernedMemoryEvent"("governedJourneyId", "recordedAt", "id");

-- RLS remains enabled and no client policy is added. Historical events remain case-scoped;
-- no GovernedJourney is inferred or backfilled.
