CREATE TYPE "GovernedMemoryTransitionType" AS ENUM (
  'ESTABLISH_FACT', 'DISPUTE_FACT', 'VALIDATE_DECISION',
  'GRANT_JOURNEY_MEMORY_ROLE', 'REVOKE_JOURNEY_MEMORY_ROLE'
);

CREATE TABLE "GovernedMemoryTransitionRequest" (
  "id" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "transitionType" "GovernedMemoryTransitionType" NOT NULL,
  "relationTemplateId" TEXT NOT NULL,
  "governedJourneyId" TEXT NOT NULL,
  "relationCaseId" TEXT,
  "targetUserId" TEXT,
  "role" "GovernedMemoryRole",
  "factId" TEXT,
  "decisionId" TEXT,
  "roleAssignmentId" TEXT,
  "validationId" TEXT,
  "disputeId" TEXT,
  "eventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "GovernedMemoryTransitionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryTransitionRequest_request_key_check" CHECK ("requestKey" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "GovernedMemoryTransitionRequest_fingerprint_check" CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "GovernedMemoryTransitionRequest_role_check" CHECK ("role" IS NULL OR "role" IN ('MEMORY_STEWARD', 'MEMORY_DELEGATE')),
  CONSTRAINT "GovernedMemoryTransitionRequest_shape_check" CHECK (
    ("transitionType" IN ('GRANT_JOURNEY_MEMORY_ROLE', 'REVOKE_JOURNEY_MEMORY_ROLE') AND "targetUserId" IS NOT NULL AND "role" IS NOT NULL AND "factId" IS NULL AND "decisionId" IS NULL)
    OR ("transitionType" IN ('ESTABLISH_FACT', 'DISPUTE_FACT') AND "targetUserId" IS NULL AND "role" IS NULL AND "factId" IS NOT NULL AND "decisionId" IS NULL)
    OR ("transitionType" = 'VALIDATE_DECISION' AND "targetUserId" IS NULL AND "role" IS NULL AND "factId" IS NULL AND "decisionId" IS NOT NULL)
  ),
  CONSTRAINT "GovernedMemoryTransitionRequest_completion_check" CHECK (
    ("completedAt" IS NULL AND "roleAssignmentId" IS NULL AND "validationId" IS NULL AND "disputeId" IS NULL AND "eventId" IS NULL)
    OR ("completedAt" IS NOT NULL AND (
      ("transitionType" IN ('GRANT_JOURNEY_MEMORY_ROLE', 'REVOKE_JOURNEY_MEMORY_ROLE') AND "roleAssignmentId" IS NOT NULL AND "validationId" IS NULL AND "disputeId" IS NULL AND "eventId" IS NULL)
      OR ("transitionType" = 'ESTABLISH_FACT' AND "validationId" IS NOT NULL AND "eventId" IS NOT NULL AND "roleAssignmentId" IS NULL AND "disputeId" IS NULL)
      OR ("transitionType" = 'DISPUTE_FACT' AND "disputeId" IS NOT NULL AND "eventId" IS NOT NULL AND "roleAssignmentId" IS NULL AND "validationId" IS NULL)
      OR ("transitionType" = 'VALIDATE_DECISION' AND "validationId" IS NOT NULL AND "eventId" IS NOT NULL AND "roleAssignmentId" IS NULL AND "disputeId" IS NULL)
    ))
  )
);

CREATE UNIQUE INDEX "GovernedMemoryTransitionRequest_requesterUserId_requestKey_key" ON "GovernedMemoryTransitionRequest"("requesterUserId", "requestKey");
CREATE UNIQUE INDEX "GovernedMemoryTransitionRequest_roleAssignmentId_key" ON "GovernedMemoryTransitionRequest"("roleAssignmentId");
CREATE UNIQUE INDEX "GovernedMemoryTransitionRequest_validationId_key" ON "GovernedMemoryTransitionRequest"("validationId");
CREATE UNIQUE INDEX "GovernedMemoryTransitionRequest_disputeId_key" ON "GovernedMemoryTransitionRequest"("disputeId");
CREATE UNIQUE INDEX "GovernedMemoryTransitionRequest_eventId_key" ON "GovernedMemoryTransitionRequest"("eventId");
CREATE INDEX "GovernedMemoryTransitionRequest_governedJourneyId_createdAt_idx" ON "GovernedMemoryTransitionRequest"("governedJourneyId", "createdAt");
CREATE INDEX "GovernedMemoryTransitionRequest_relationTemplateId_createdAt_idx" ON "GovernedMemoryTransitionRequest"("relationTemplateId", "createdAt");
CREATE INDEX "GovernedMemoryTransitionRequest_relationCaseId_createdAt_idx" ON "GovernedMemoryTransitionRequest"("relationCaseId", "createdAt");

ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_governedJourneyId_relationTemplateId_fkey" FOREIGN KEY ("governedJourneyId", "relationTemplateId") REFERENCES "GovernedJourney"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_relationCaseId_relationTemplateId_fkey" FOREIGN KEY ("relationCaseId", "relationTemplateId") REFERENCES "RelationCase"("id", "templateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_factId_fkey" FOREIGN KEY ("factId") REFERENCES "GovernedMemoryFact"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "GovernedMemoryDecision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_roleAssignmentId_fkey" FOREIGN KEY ("roleAssignmentId") REFERENCES "GovernedJourneyMemoryRoleAssignment"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "GovernedMemoryValidation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "GovernedMemoryDispute"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryTransitionRequest" ADD CONSTRAINT "GovernedMemoryTransitionRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GovernedMemoryEvent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedMemoryTransitionRequest" ENABLE ROW LEVEL SECURITY;
