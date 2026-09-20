-- Additive V1 foundation for idempotent public case creation.
-- Stores only HMAC/hash material; candidate access tokens and request payloads are excluded.
CREATE TABLE "PublicCaseCreationRequest" (
    "id" TEXT NOT NULL,
    "gLinkId" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "relationCaseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicCaseCreationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicCaseCreationRequest_expiresAt_idx"
ON "PublicCaseCreationRequest"("expiresAt");

CREATE UNIQUE INDEX "PublicCaseCreationRequest_gLinkId_idempotencyKeyHash_key"
ON "PublicCaseCreationRequest"("gLinkId", "idempotencyKeyHash");

ALTER TABLE "PublicCaseCreationRequest"
ADD CONSTRAINT "PublicCaseCreationRequest_gLinkId_fkey"
FOREIGN KEY ("gLinkId") REFERENCES "GLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublicCaseCreationRequest"
ADD CONSTRAINT "PublicCaseCreationRequest_relationCaseId_fkey"
FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
