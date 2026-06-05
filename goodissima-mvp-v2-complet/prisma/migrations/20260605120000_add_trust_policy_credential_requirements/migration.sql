-- AlterTable
ALTER TABLE "RelationCase" ADD COLUMN "candidateIdentityId" TEXT;

-- CreateTable
CREATE TABLE "TrustPolicyCredentialRequirement" (
    "id" TEXT NOT NULL,
    "trustPolicyId" TEXT NOT NULL,
    "credentialTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustPolicyCredentialRequirement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrustPolicyCredentialRequirement_trustPolicyId_fkey" FOREIGN KEY ("trustPolicyId") REFERENCES "TrustPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrustPolicyCredentialRequirement_credentialTypeId_fkey" FOREIGN KEY ("credentialTypeId") REFERENCES "CredentialType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustPolicyCredentialRequirement_trustPolicyId_credentialTypeId_key" ON "TrustPolicyCredentialRequirement"("trustPolicyId", "credentialTypeId");

-- CreateIndex
CREATE INDEX "TrustPolicyCredentialRequirement_trustPolicyId_idx" ON "TrustPolicyCredentialRequirement"("trustPolicyId");

-- CreateIndex
CREATE INDEX "TrustPolicyCredentialRequirement_credentialTypeId_idx" ON "TrustPolicyCredentialRequirement"("credentialTypeId");

-- CreateIndex
CREATE INDEX "RelationCase_candidateIdentityId_idx" ON "RelationCase"("candidateIdentityId");

-- AddForeignKey
ALTER TABLE "RelationCase" ADD CONSTRAINT "RelationCase_candidateIdentityId_fkey" FOREIGN KEY ("candidateIdentityId") REFERENCES "GoodissimaIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
