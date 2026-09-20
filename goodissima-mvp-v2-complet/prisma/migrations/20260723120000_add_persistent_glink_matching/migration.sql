-- MatchingRun and MatchingResult are the persistent business aggregates for
-- GLink matching. Existing AIEvent JSON remains legacy audit history and is
-- intentionally not migrated.
CREATE TYPE "MatchingRunStatus" AS ENUM (
  'PREPARED',
  'RUNNING',
  'RESULTS_AVAILABLE',
  'FAILED',
  'CLOSED'
);

CREATE TYPE "MatchingResultStatus" AS ENUM (
  'AVAILABLE',
  'SELECTED',
  'DISMISSED',
  'LINKED'
);

CREATE TABLE "MatchingRun" (
  "id" TEXT NOT NULL,
  "gLinkId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "status" "MatchingRunStatus" NOT NULL DEFAULT 'PREPARED',
  "isPaused" BOOLEAN NOT NULL DEFAULT false,
  "engineVersion" TEXT NOT NULL,
  "criteriaSnapshot" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchingRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchingResult" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "targetGLinkId" TEXT NOT NULL,
  "status" "MatchingResultStatus" NOT NULL DEFAULT 'AVAILABLE',
  "explanation" JSONB NOT NULL,
  "internalRank" INTEGER,
  "selectedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "linkedAt" TIMESTAMP(3),
  "relationCaseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchingResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatchingRun_gLinkId_createdAt_idx" ON "MatchingRun"("gLinkId", "createdAt");
CREATE INDEX "MatchingRun_ownerId_status_idx" ON "MatchingRun"("ownerId", "status");
CREATE INDEX "MatchingRun_ownerId_isPaused_idx" ON "MatchingRun"("ownerId", "isPaused");
CREATE UNIQUE INDEX "MatchingRun_ownerId_idempotencyKey_key" ON "MatchingRun"("ownerId", "idempotencyKey");
CREATE UNIQUE INDEX "MatchingResult_runId_targetGLinkId_key" ON "MatchingResult"("runId", "targetGLinkId");
CREATE INDEX "MatchingResult_runId_status_idx" ON "MatchingResult"("runId", "status");
CREATE INDEX "MatchingResult_targetGLinkId_idx" ON "MatchingResult"("targetGLinkId");
CREATE INDEX "MatchingResult_relationCaseId_idx" ON "MatchingResult"("relationCaseId");

ALTER TABLE "MatchingRun"
  ADD CONSTRAINT "MatchingRun_gLinkId_fkey"
  FOREIGN KEY ("gLinkId") REFERENCES "GLink"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchingRun"
  ADD CONSTRAINT "MatchingRun_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchingResult"
  ADD CONSTRAINT "MatchingResult_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "MatchingRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchingResult"
  ADD CONSTRAINT "MatchingResult_targetGLinkId_fkey"
  FOREIGN KEY ("targetGLinkId") REFERENCES "GLink"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchingResult"
  ADD CONSTRAINT "MatchingResult_relationCaseId_fkey"
  FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Follow the existing server-only Prisma convention: browser roles remain
-- denied because no RLS policies are added, while DATABASE_URL access remains
-- available because RLS is deliberately not forced. Future repositories must
-- still scope every query and mutation by ownerId.
ALTER TABLE "MatchingRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchingResult" ENABLE ROW LEVEL SECURITY;
