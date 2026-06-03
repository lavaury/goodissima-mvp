-- CreateEnum
CREATE TYPE "TrustPolicyScope" AS ENUM ('TEMPLATE', 'GLINK', 'RELATION_CASE');

-- CreateEnum
CREATE TYPE "TrustPolicyAccessMode" AS ENUM ('PUBLIC_LINK', 'INVITED_OWNER_ONLY', 'TOKEN_HOLDER', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "TrustPolicyStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "TrustPolicy" (
    "id" TEXT NOT NULL,
    "scope" "TrustPolicyScope" NOT NULL,
    "templateId" TEXT,
    "gLinkId" TEXT,
    "relationCaseId" TEXT,
    "accessMode" "TrustPolicyAccessMode" NOT NULL DEFAULT 'PUBLIC_LINK',
    "candidateCanRead" BOOLEAN NOT NULL DEFAULT true,
    "candidateCanWrite" BOOLEAN NOT NULL DEFAULT true,
    "ownerCanRead" BOOLEAN NOT NULL DEFAULT true,
    "ownerCanWrite" BOOLEAN NOT NULL DEFAULT true,
    "requireCandidateEmail" BOOLEAN NOT NULL DEFAULT true,
    "requireCandidateConsent" BOOLEAN NOT NULL DEFAULT false,
    "allowDocuments" BOOLEAN NOT NULL DEFAULT true,
    "candidateTokenTtlDays" INTEGER NOT NULL DEFAULT 30,
    "status" "TrustPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustPolicy_scope_status_idx" ON "TrustPolicy"("scope", "status");

-- CreateIndex
CREATE INDEX "TrustPolicy_templateId_idx" ON "TrustPolicy"("templateId");

-- CreateIndex
CREATE INDEX "TrustPolicy_gLinkId_idx" ON "TrustPolicy"("gLinkId");

-- CreateIndex
CREATE INDEX "TrustPolicy_relationCaseId_idx" ON "TrustPolicy"("relationCaseId");

-- AddForeignKey
ALTER TABLE "TrustPolicy" ADD CONSTRAINT "TrustPolicy_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RelationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustPolicy" ADD CONSTRAINT "TrustPolicy_gLinkId_fkey" FOREIGN KEY ("gLinkId") REFERENCES "GLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustPolicy" ADD CONSTRAINT "TrustPolicy_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
