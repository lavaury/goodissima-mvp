CREATE TYPE "RelationGovernanceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED', 'BLOCKED');

ALTER TABLE "RelationCase"
ADD COLUMN "governanceStatus" "RelationGovernanceStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "governanceUpdatedAt" TIMESTAMP(3),
ADD COLUMN "governanceReason" TEXT;

CREATE INDEX "RelationCase_governanceStatus_idx" ON "RelationCase"("governanceStatus");
