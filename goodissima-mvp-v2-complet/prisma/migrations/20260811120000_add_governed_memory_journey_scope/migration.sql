ALTER TYPE "GovernedMemoryPermission" ADD VALUE 'REGISTER_SOURCE';
CREATE TYPE "GovernedMemoryCreationCategory" AS ENUM ('FACT', 'DECISION', 'SOURCE');

ALTER TABLE "GovernedMemoryFact" ADD COLUMN "relationTemplateId" TEXT, ADD COLUMN "governedJourneyId" TEXT;
ALTER TABLE "GovernedMemoryDecision" ADD COLUMN "relationTemplateId" TEXT, ADD COLUMN "governedJourneyId" TEXT;
ALTER TABLE "GovernedMemorySource" ADD COLUMN "relationTemplateId" TEXT;

-- Structural backfill only. No GovernedJourney is inferred.
UPDATE "GovernedMemoryFact" m SET "relationTemplateId" = c."templateId" FROM "RelationCase" c WHERE m."relationCaseId" = c.id;
UPDATE "GovernedMemoryDecision" m SET "relationTemplateId" = c."templateId" FROM "RelationCase" c WHERE m."relationCaseId" = c.id;
UPDATE "GovernedMemorySource" m SET "relationTemplateId" = c."templateId" FROM "RelationCase" c WHERE m."relationCaseId" = c.id;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GovernedMemoryFact" WHERE "relationTemplateId" IS NULL) THEN RAISE EXCEPTION 'R5_I1_FACT_BACKFILL_FAILED'; END IF;
  IF EXISTS (SELECT 1 FROM "GovernedMemoryDecision" WHERE "relationTemplateId" IS NULL) THEN RAISE EXCEPTION 'R5_I1_DECISION_BACKFILL_FAILED'; END IF;
  IF EXISTS (SELECT 1 FROM "GovernedMemorySource" WHERE "relationTemplateId" IS NULL) THEN RAISE EXCEPTION 'R5_I1_SOURCE_BACKFILL_FAILED'; END IF;
END $$;

ALTER TABLE "GovernedMemoryFact" ALTER COLUMN "relationTemplateId" SET NOT NULL, ALTER COLUMN "relationCaseId" DROP NOT NULL;
ALTER TABLE "GovernedMemoryDecision" ALTER COLUMN "relationTemplateId" SET NOT NULL, ALTER COLUMN "relationCaseId" DROP NOT NULL;
ALTER TABLE "GovernedMemorySource" ALTER COLUMN "relationTemplateId" SET NOT NULL, ALTER COLUMN "relationCaseId" DROP NOT NULL;

ALTER TABLE "GovernedMemoryFact" DROP CONSTRAINT "GovernedMemoryFact_relationCaseId_fkey";
ALTER TABLE "GovernedMemoryDecision" DROP CONSTRAINT "GovernedMemoryDecision_relationCaseId_fkey";
ALTER TABLE "GovernedMemorySource" DROP CONSTRAINT "GovernedMemorySource_relationCaseId_fkey";
ALTER TABLE "GovernedMemorySource" DROP CONSTRAINT "GovernedMemorySource_governedJourneyId_relationCaseId_fkey";

ALTER TABLE "GovernedMemoryFact"
  ADD CONSTRAINT "GovernedMemoryFact_scope_check" CHECK ("relationCaseId" IS NOT NULL OR "governedJourneyId" IS NOT NULL),
  ADD CONSTRAINT "GovernedMemoryFact_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryFact_relationCaseId_relationTemplateId_fkey" FOREIGN KEY ("relationCaseId", "relationTemplateId") REFERENCES "RelationCase"(id, "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryFact_governedJourneyId_relationTemplateId_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"(id, "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedMemoryDecision"
  ADD CONSTRAINT "GovernedMemoryDecision_scope_check" CHECK ("relationCaseId" IS NOT NULL OR "governedJourneyId" IS NOT NULL),
  ADD CONSTRAINT "GovernedMemoryDecision_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryDecision_relationCaseId_relationTemplateId_fkey" FOREIGN KEY ("relationCaseId", "relationTemplateId") REFERENCES "RelationCase"(id, "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryDecision_governedJourneyId_relationTemplateId_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"(id, "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedMemorySource"
  ADD CONSTRAINT "GovernedMemorySource_scope_check" CHECK ("relationCaseId" IS NOT NULL OR "governedJourneyId" IS NOT NULL),
  ADD CONSTRAINT "GovernedMemorySource_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemorySource_relationCaseId_relationTemplateId_fkey" FOREIGN KEY ("relationCaseId", "relationTemplateId") REFERENCES "RelationCase"(id, "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemorySource_governedJourneyId_relationTemplateId_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"(id, "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "GovernedMemoryFact_governedJourneyId_recordedAt_id_idx" ON "GovernedMemoryFact"("governedJourneyId", "recordedAt", id);
CREATE INDEX "GovernedMemoryFact_relationTemplateId_recordedAt_id_idx" ON "GovernedMemoryFact"("relationTemplateId", "recordedAt", id);
CREATE INDEX "GovernedMemoryDecision_governedJourneyId_recordedAt_id_idx" ON "GovernedMemoryDecision"("governedJourneyId", "recordedAt", id);
CREATE INDEX "GovernedMemoryDecision_relationTemplateId_recordedAt_id_idx" ON "GovernedMemoryDecision"("relationTemplateId", "recordedAt", id);
CREATE INDEX "GovernedMemorySource_governedJourneyId_recordedAt_id_idx" ON "GovernedMemorySource"("governedJourneyId", "recordedAt", id);
CREATE INDEX "GovernedMemorySource_relationTemplateId_recordedAt_id_idx" ON "GovernedMemorySource"("relationTemplateId", "recordedAt", id);

CREATE TABLE "GovernedMemoryCreationRequest" (
  id TEXT NOT NULL, "requesterUserId" TEXT NOT NULL, "requestKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL, category "GovernedMemoryCreationCategory" NOT NULL,
  "relationTemplateId" TEXT NOT NULL, "governedJourneyId" TEXT NOT NULL, "relationCaseId" TEXT,
  "factId" TEXT, "decisionId" TEXT, "sourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "GovernedMemoryCreationRequest_pkey" PRIMARY KEY (id),
  CONSTRAINT "GovernedMemoryCreationRequest_requestKey_format_check" CHECK ("requestKey" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "GovernedMemoryCreationRequest_requestFingerprint_format_check" CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "GovernedMemoryCreationRequest_completion_check" CHECK (
    ("completedAt" IS NULL AND "factId" IS NULL AND "decisionId" IS NULL AND "sourceId" IS NULL)
    OR ("completedAt" IS NOT NULL AND (
      (category = 'FACT' AND "factId" IS NOT NULL AND "decisionId" IS NULL AND "sourceId" IS NULL)
      OR (category = 'DECISION' AND "factId" IS NULL AND "decisionId" IS NOT NULL AND "sourceId" IS NULL)
      OR (category = 'SOURCE' AND "factId" IS NULL AND "decisionId" IS NULL AND "sourceId" IS NOT NULL)
    ))
  )
);

CREATE UNIQUE INDEX "GovernedMemoryCreationRequest_requesterUserId_requestKey_key" ON "GovernedMemoryCreationRequest"("requesterUserId", "requestKey");
CREATE UNIQUE INDEX "GovernedMemoryCreationRequest_factId_key" ON "GovernedMemoryCreationRequest"("factId");
CREATE UNIQUE INDEX "GovernedMemoryCreationRequest_decisionId_key" ON "GovernedMemoryCreationRequest"("decisionId");
CREATE UNIQUE INDEX "GovernedMemoryCreationRequest_sourceId_key" ON "GovernedMemoryCreationRequest"("sourceId");
CREATE INDEX "GovernedMemoryCreationRequest_governedJourneyId_createdAt_idx" ON "GovernedMemoryCreationRequest"("governedJourneyId", "createdAt");
CREATE INDEX "GovernedMemoryCreationRequest_relationTemplateId_createdAt_idx" ON "GovernedMemoryCreationRequest"("relationTemplateId", "createdAt");
CREATE INDEX "GovernedMemoryCreationRequest_relationCaseId_createdAt_idx" ON "GovernedMemoryCreationRequest"("relationCaseId", "createdAt");

ALTER TABLE "GovernedMemoryCreationRequest"
  ADD CONSTRAINT "GovernedMemoryCreationRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryCreationRequest_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryCreationRequest_governedJourneyId_relationTemplateId_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"(id, "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryCreationRequest_relationCaseId_relationTemplateId_fkey" FOREIGN KEY ("relationCaseId", "relationTemplateId") REFERENCES "RelationCase"(id, "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryCreationRequest_factId_fkey" FOREIGN KEY ("factId") REFERENCES "GovernedMemoryFact"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryCreationRequest_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "GovernedMemoryDecision"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedMemoryCreationRequest_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GovernedMemorySource"(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedMemoryCreationRequest" ENABLE ROW LEVEL SECURITY;
