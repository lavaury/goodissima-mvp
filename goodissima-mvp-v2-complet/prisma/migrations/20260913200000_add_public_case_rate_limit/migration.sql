-- Additive V1 foundation for atomic, persistent public case creation quotas.
CREATE TABLE "PublicRateLimitBucket" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicRateLimitBucket_expiresAt_idx"
ON "PublicRateLimitBucket"("expiresAt");

CREATE UNIQUE INDEX "PublicRateLimitBucket_dimension_keyHash_windowStart_windowSeconds_key"
ON "PublicRateLimitBucket"("dimension", "keyHash", "windowStart", "windowSeconds");
