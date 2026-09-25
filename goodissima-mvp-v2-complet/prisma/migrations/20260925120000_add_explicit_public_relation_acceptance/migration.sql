ALTER TABLE "PublicCaseCreationRequest"
  ADD COLUMN "requestPayload" JSONB,
  ADD COLUMN "requesterIdentityId" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3),
  ADD COLUMN "decidedByUserId" TEXT,
  ADD COLUMN "declineReason" TEXT;

ALTER TABLE "PublicCaseCreationRequest"
  ADD CONSTRAINT "PublicCaseCreationRequest_requesterIdentityId_fkey"
    FOREIGN KEY ("requesterIdentityId") REFERENCES "GoodissimaIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PublicCaseCreationRequest_decidedByUserId_fkey"
    FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PublicCaseCreationRequest_decision_state_check" CHECK (
    "requestPayload" IS NULL
    OR ("status" = 'PENDING' AND "decidedAt" IS NULL AND "decidedByUserId" IS NULL AND "relationCaseId" IS NULL)
    OR ("status" = 'ACCEPTED' AND "decidedAt" IS NOT NULL AND "decidedByUserId" IS NOT NULL AND "relationCaseId" IS NOT NULL)
    OR ("status" = 'DECLINED' AND "decidedAt" IS NOT NULL AND "decidedByUserId" IS NOT NULL AND "relationCaseId" IS NULL)
    OR ("status" = 'COMPLETED')
  );

CREATE INDEX "PublicCaseCreationRequest_gLinkId_status_createdAt_idx"
  ON "PublicCaseCreationRequest"("gLinkId", "status", "createdAt");
CREATE INDEX "PublicCaseCreationRequest_decidedByUserId_decidedAt_idx"
  ON "PublicCaseCreationRequest"("decidedByUserId", "decidedAt");
