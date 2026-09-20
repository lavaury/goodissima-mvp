ALTER TABLE "GovernedMemoryValidation" ADD COLUMN "relationTemplateId" TEXT;
ALTER TABLE "GovernedMemoryValidation" ADD COLUMN "governedJourneyId" TEXT;
ALTER TABLE "GovernedMemoryDispute" ADD COLUMN "relationTemplateId" TEXT;
ALTER TABLE "GovernedMemoryDispute" ADD COLUMN "governedJourneyId" TEXT;

UPDATE "GovernedMemoryValidation" v SET "relationTemplateId" = c."templateId"
FROM "RelationCase" c WHERE v."relationCaseId" = c."id";
UPDATE "GovernedMemoryDispute" d SET "relationTemplateId" = c."templateId"
FROM "RelationCase" c WHERE d."relationCaseId" = c."id";

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GovernedMemoryValidation" WHERE "relationTemplateId" IS NULL) THEN RAISE EXCEPTION 'GOVERNED_MEMORY_VALIDATION_ROOT_BACKFILL_INCOMPLETE'; END IF;
  IF EXISTS (SELECT 1 FROM "GovernedMemoryDispute" WHERE "relationTemplateId" IS NULL) THEN RAISE EXCEPTION 'GOVERNED_MEMORY_DISPUTE_ROOT_BACKFILL_INCOMPLETE'; END IF;
END $$;

ALTER TABLE "GovernedMemoryValidation" ALTER COLUMN "relationTemplateId" SET NOT NULL;
ALTER TABLE "GovernedMemoryValidation" ALTER COLUMN "relationCaseId" DROP NOT NULL;
ALTER TABLE "GovernedMemoryDispute" ALTER COLUMN "relationTemplateId" SET NOT NULL;
ALTER TABLE "GovernedMemoryDispute" ALTER COLUMN "relationCaseId" DROP NOT NULL;

ALTER TABLE "GovernedMemoryValidation" DROP CONSTRAINT "GovernedMemoryValidation_relationCaseId_fkey";
ALTER TABLE "GovernedMemoryDispute" DROP CONSTRAINT "GovernedMemoryDispute_relationCaseId_fkey";
ALTER TABLE "GovernedMemoryValidation" ADD CONSTRAINT "GovernedMemoryValidation_scope_check" CHECK ("relationCaseId" IS NOT NULL OR "governedJourneyId" IS NOT NULL);
ALTER TABLE "GovernedMemoryDispute" ADD CONSTRAINT "GovernedMemoryDispute_scope_check" CHECK ("relationCaseId" IS NOT NULL OR "governedJourneyId" IS NOT NULL);
ALTER TABLE "GovernedMemoryValidation" ADD CONSTRAINT "GovernedMemoryValidation_relationCaseId_relationTemplateId_fkey" FOREIGN KEY ("relationCaseId", "relationTemplateId") REFERENCES "RelationCase"("id", "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryValidation" ADD CONSTRAINT "GovernedMemoryValidation_governedJourneyId_relationTemplateId_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryValidation" ADD CONSTRAINT "GovernedMemoryValidation_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryDispute" ADD CONSTRAINT "GovernedMemoryDispute_relationCaseId_relationTemplateId_fkey" FOREIGN KEY ("relationCaseId", "relationTemplateId") REFERENCES "RelationCase"("id", "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryDispute" ADD CONSTRAINT "GovernedMemoryDispute_governedJourneyId_relationTemplateId_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryDispute" ADD CONSTRAINT "GovernedMemoryDispute_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "GovernedMemoryValidation_governedJourneyId_targetType_targetId_validatedAt_idx" ON "GovernedMemoryValidation"("governedJourneyId", "targetType", "targetId", "validatedAt");
CREATE INDEX "GovernedMemoryValidation_relationTemplateId_validatedAt_idx" ON "GovernedMemoryValidation"("relationTemplateId", "validatedAt");
CREATE INDEX "GovernedMemoryDispute_governedJourneyId_targetType_targetId_status_idx" ON "GovernedMemoryDispute"("governedJourneyId", "targetType", "targetId", "status");
CREATE INDEX "GovernedMemoryDispute_relationTemplateId_raisedAt_idx" ON "GovernedMemoryDispute"("relationTemplateId", "raisedAt");

CREATE TABLE "GovernedJourneyMemoryRoleAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "governedJourneyId" TEXT NOT NULL,
  "relationTemplateId" TEXT NOT NULL,
  "role" "GovernedMemoryRole" NOT NULL,
  "grantedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "GovernedJourneyMemoryRoleAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedJourneyMemoryRoleAssignment_role_check" CHECK ("role" IN ('MEMORY_STEWARD', 'MEMORY_DELEGATE')),
  CONSTRAINT "GovernedJourneyMemoryRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "GovernedJourneyMemoryRoleAssignment_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "GovernedJourneyMemoryRoleAssignment_journey_root_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "GovernedJourneyMemoryRoleAssignment_userId_governedJourneyId_role_key" ON "GovernedJourneyMemoryRoleAssignment"("userId", "governedJourneyId", "role");
CREATE INDEX "GovernedJourneyMemoryRoleAssignment_userId_governedJourneyId_revokedAt_idx" ON "GovernedJourneyMemoryRoleAssignment"("userId", "governedJourneyId", "revokedAt");
CREATE INDEX "GovernedJourneyMemoryRoleAssignment_governedJourneyId_revokedAt_idx" ON "GovernedJourneyMemoryRoleAssignment"("governedJourneyId", "revokedAt");
CREATE INDEX "GovernedJourneyMemoryRoleAssignment_relationTemplateId_idx" ON "GovernedJourneyMemoryRoleAssignment"("relationTemplateId");
ALTER TABLE "GovernedJourneyMemoryRoleAssignment" ENABLE ROW LEVEL SECURITY;
