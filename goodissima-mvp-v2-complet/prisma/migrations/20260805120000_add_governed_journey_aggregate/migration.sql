CREATE TYPE "GovernedJourneyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'CANCELLED');
CREATE TYPE "GovernedJourneyEventType" AS ENUM ('CREATED');

CREATE UNIQUE INDEX "RelationCase_id_ownerId_key" ON "RelationCase"("id", "ownerId");
CREATE UNIQUE INDEX "TemplateVersion_id_templateId_key" ON "TemplateVersion"("id", "templateId");

CREATE TABLE "GovernedJourney" (
  "id" TEXT NOT NULL,
  "relationCaseId" TEXT NOT NULL,
  "formTemplateId" TEXT,
  "relationTemplateId" TEXT NOT NULL,
  "createdFromTemplateVersionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "GovernedJourneyStatus" NOT NULL DEFAULT 'DRAFT',
  "authorityUserId" TEXT NOT NULL,
  "currentStepKey" TEXT,
  "startedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedJourney_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedJourney_title_not_blank_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "GovernedJourney_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "startedAt" IS NULL AND "suspendedAt" IS NULL AND "closedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'ACTIVE' AND "startedAt" IS NOT NULL AND "closedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'SUSPENDED' AND "startedAt" IS NOT NULL AND "suspendedAt" IS NOT NULL AND "closedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'CLOSED' AND "startedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "closedAt" IS NULL)
  )
);

CREATE TABLE "GovernedJourneyEvent" (
  "id" TEXT NOT NULL,
  "governedJourneyId" TEXT NOT NULL,
  "relationCaseId" TEXT NOT NULL,
  "type" "GovernedJourneyEventType" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedJourneyEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernedJourney_id_relationCaseId_key" ON "GovernedJourney"("id", "relationCaseId");
CREATE INDEX "GovernedJourney_relationCaseId_status_createdAt_idx" ON "GovernedJourney"("relationCaseId", "status", "createdAt");
CREATE INDEX "GovernedJourney_relationTemplateId_idx" ON "GovernedJourney"("relationTemplateId");
CREATE INDEX "GovernedJourney_formTemplateId_idx" ON "GovernedJourney"("formTemplateId");
CREATE INDEX "GovernedJourney_authorityUserId_status_idx" ON "GovernedJourney"("authorityUserId", "status");
CREATE INDEX "GovernedJourneyEvent_governedJourneyId_occurredAt_id_idx" ON "GovernedJourneyEvent"("governedJourneyId", "occurredAt", "id");
CREATE INDEX "GovernedJourneyEvent_relationCaseId_occurredAt_id_idx" ON "GovernedJourneyEvent"("relationCaseId", "occurredAt", "id");

ALTER TABLE "GovernedJourney" ADD CONSTRAINT "GovernedJourney_relationCaseId_authorityUserId_fkey" FOREIGN KEY ("relationCaseId", "authorityUserId") REFERENCES "RelationCase"("id", "ownerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedJourney" ADD CONSTRAINT "GovernedJourney_authorityUserId_fkey" FOREIGN KEY ("authorityUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedJourney" ADD CONSTRAINT "GovernedJourney_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedJourney" ADD CONSTRAINT "GovernedJourney_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedJourney" ADD CONSTRAINT "GovernedJourney_createdFromTemplateVersionId_relationTemplateId_fkey" FOREIGN KEY ("createdFromTemplateVersionId", "relationTemplateId") REFERENCES "TemplateVersion"("id", "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedJourneyEvent" ADD CONSTRAINT "GovernedJourneyEvent_governedJourneyId_relationCaseId_fkey" FOREIGN KEY ("governedJourneyId", "relationCaseId") REFERENCES "GovernedJourney"("id", "relationCaseId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedJourneyEvent" ADD CONSTRAINT "GovernedJourneyEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- No legacy row is inserted. Existing invitations, communication sessions and
-- template/case links do not prove which FormTemplate and TemplateVersion were
-- instantiated. Historical instances require explicit human recovery.

ALTER TABLE "GovernedJourney" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedJourneyEvent" ENABLE ROW LEVEL SECURITY;
