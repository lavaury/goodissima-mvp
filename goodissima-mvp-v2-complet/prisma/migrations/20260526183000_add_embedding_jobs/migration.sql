ALTER TABLE "RelationCase"
  ADD COLUMN "embeddingStatus" TEXT NOT NULL DEFAULT 'fresh',
  ADD COLUMN "embeddingUpdatedAt" TIMESTAMP(3);

CREATE TABLE "EmbeddingJob" (
  "id" TEXT NOT NULL,
  "relationCaseId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "triggerType" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "EmbeddingJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmbeddingJob_status_createdAt_idx" ON "EmbeddingJob"("status", "createdAt");
CREATE INDEX "EmbeddingJob_relationCaseId_status_idx" ON "EmbeddingJob"("relationCaseId", "status");

ALTER TABLE "EmbeddingJob"
  ADD CONSTRAINT "EmbeddingJob_relationCaseId_fkey"
  FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
