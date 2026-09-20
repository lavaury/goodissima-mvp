-- Additive safety foundation for the still-internal cross-owner matching pipeline.
ALTER TABLE "MatchingRun"
ADD COLUMN "criteriaFingerprintHash" TEXT,
ADD COLUMN "cacheValidUntil" TIMESTAMP(3);

CREATE INDEX "MatchingRun_ownerId_gLinkId_criteriaFingerprintHash_createdAt_idx"
ON "MatchingRun"("ownerId", "gLinkId", "criteriaFingerprintHash", "createdAt");

CREATE INDEX "MatchingRun_cacheValidUntil_idx"
ON "MatchingRun"("cacheValidUntil");

CREATE INDEX "MatchingRun_createdAt_idx"
ON "MatchingRun"("createdAt");

CREATE TABLE "MatchingExecutionLease" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "gLinkId" TEXT NOT NULL,
    "criteriaFingerprintHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingExecutionLease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchingExecutionLease_ownerId_gLinkId_criteriaFingerprintHash_key"
ON "MatchingExecutionLease"("ownerId", "gLinkId", "criteriaFingerprintHash");

CREATE INDEX "MatchingExecutionLease_expiresAt_idx"
ON "MatchingExecutionLease"("expiresAt");

ALTER TABLE "MatchingExecutionLease"
ADD CONSTRAINT "MatchingExecutionLease_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchingExecutionLease"
ADD CONSTRAINT "MatchingExecutionLease_gLinkId_fkey"
FOREIGN KEY ("gLinkId") REFERENCES "GLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supports the exact candidate predicate: consented ACTIVE Opportunities of a complementary type,
-- returned in stable id order. The partial predicate keeps the index narrow.
CREATE INDEX "GLink_cross_owner_matching_candidates_idx"
ON "GLink"("status", (("rules" #>> '{opportunity,type}')), "id")
WHERE ("rules" #>> '{opportunity,matchingEnabled}') = 'true';
