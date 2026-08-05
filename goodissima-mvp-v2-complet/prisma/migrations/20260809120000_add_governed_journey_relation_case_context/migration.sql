-- R1-C1 adds an empty structural context table. Contexts require an explicit
-- future human command and prove neither permission nor memory provenance.
CREATE UNIQUE INDEX "GovernedJourney_id_relationTemplateId_key"
  ON "GovernedJourney"("id", "relationTemplateId");

CREATE UNIQUE INDEX "RelationCase_id_templateId_key"
  ON "RelationCase"("id", "templateId");

CREATE TABLE "GovernedJourneyRelationCase" (
  "governedJourneyId" TEXT NOT NULL,
  "relationCaseId" TEXT NOT NULL,
  "relationTemplateId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GovernedJourneyRelationCase_pkey"
    PRIMARY KEY ("governedJourneyId", "relationCaseId")
);

CREATE UNIQUE INDEX "GovernedJourneyRelationCase_relationCaseId_relationTemplateId_key"
  ON "GovernedJourneyRelationCase"("relationCaseId", "relationTemplateId");

CREATE INDEX "GovernedJourneyRelationCase_relationTemplateId_idx"
  ON "GovernedJourneyRelationCase"("relationTemplateId");

CREATE INDEX "GovernedJourneyRelationCase_createdByUserId_createdAt_idx"
  ON "GovernedJourneyRelationCase"("createdByUserId", "createdAt");

ALTER TABLE "GovernedJourneyRelationCase"
  ADD CONSTRAINT "GovernedJourneyRelationCase_governedJourneyId_relationTemplateId_fkey"
  FOREIGN KEY ("governedJourneyId", "relationTemplateId")
  REFERENCES "GovernedJourney"("id", "relationTemplateId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyRelationCase"
  ADD CONSTRAINT "GovernedJourneyRelationCase_relationCaseId_relationTemplateId_fkey"
  FOREIGN KEY ("relationCaseId", "relationTemplateId")
  REFERENCES "RelationCase"("id", "templateId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyRelationCase"
  ADD CONSTRAINT "GovernedJourneyRelationCase_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyRelationCase" ENABLE ROW LEVEL SECURITY;
