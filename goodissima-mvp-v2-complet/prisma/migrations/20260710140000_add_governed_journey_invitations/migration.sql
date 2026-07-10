CREATE TYPE "GovernedJourneyInvitationRole" AS ENUM ('EXPERT', 'JUDGE', 'THIRD_PARTY', 'ASSOCIATION', 'FAMILY', 'OBSERVER', 'OTHER');
CREATE TYPE "GovernedJourneyInvitationStatus" AS ENUM ('PREPARED', 'ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "GovernedJourneyInvitation" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "relationTemplateId" TEXT NOT NULL,
  "relationCaseId" TEXT,
  "displayName" TEXT NOT NULL,
  "role" "GovernedJourneyInvitationRole" NOT NULL,
  "status" "GovernedJourneyInvitationStatus" NOT NULL DEFAULT 'ACTIVE',
  "accessTokenHash" TEXT NOT NULL,
  "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedJourneyInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernedJourneyInvitation_accessTokenHash_key" ON "GovernedJourneyInvitation"("accessTokenHash");
CREATE INDEX "GovernedJourneyInvitation_ownerId_relationTemplateId_status_idx" ON "GovernedJourneyInvitation"("ownerId", "relationTemplateId", "status");
CREATE INDEX "GovernedJourneyInvitation_accessTokenExpiresAt_status_idx" ON "GovernedJourneyInvitation"("accessTokenExpiresAt", "status");
ALTER TABLE "GovernedJourneyInvitation" ADD CONSTRAINT "GovernedJourneyInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernedJourneyInvitation" ADD CONSTRAINT "GovernedJourneyInvitation_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernedJourneyInvitation" ADD CONSTRAINT "GovernedJourneyInvitation_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
