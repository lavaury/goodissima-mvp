ALTER TABLE "RelationTemplate" ADD COLUMN "aiInstructions" TEXT;

CREATE TABLE "AIEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "promptVersion" TEXT,
    "outputSummary" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIEvent_caseId_createdAt_idx" ON "AIEvent"("caseId", "createdAt");
CREATE INDEX "AIEvent_provider_action_createdAt_idx" ON "AIEvent"("provider", "action", "createdAt");

ALTER TABLE "AIEvent" ADD CONSTRAINT "AIEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RelationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
