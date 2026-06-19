-- CreateEnum
CREATE TYPE "TrustCredentialStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TrustClaimType" AS ENUM ('STRING', 'BOOLEAN', 'INTEGER', 'DECIMAL', 'DATE', 'DATETIME', 'JSON');

-- CreateTable
CREATE TABLE "TrustCredential" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "credentialTypeId" TEXT NOT NULL,
    "issuerTrustedOrganizationId" TEXT NOT NULL,
    "status" "TrustCredentialStatus" NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustCredential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrustCredential_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "GoodissimaIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrustCredential_credentialTypeId_fkey" FOREIGN KEY ("credentialTypeId") REFERENCES "CredentialType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrustCredential_issuerTrustedOrganizationId_fkey" FOREIGN KEY ("issuerTrustedOrganizationId") REFERENCES "TrustedOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustClaim" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "claimKey" TEXT NOT NULL,
    "claimType" "TrustClaimType" NOT NULL,
    "claimValue" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustClaim_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrustClaim_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "TrustCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrustCredential_identityId_idx" ON "TrustCredential"("identityId");

-- CreateIndex
CREATE INDEX "TrustCredential_credentialTypeId_idx" ON "TrustCredential"("credentialTypeId");

-- CreateIndex
CREATE INDEX "TrustCredential_issuerTrustedOrganizationId_idx" ON "TrustCredential"("issuerTrustedOrganizationId");

-- CreateIndex
CREATE INDEX "TrustCredential_status_idx" ON "TrustCredential"("status");

-- CreateIndex
CREATE INDEX "TrustClaim_credentialId_idx" ON "TrustClaim"("credentialId");

-- CreateIndex
CREATE INDEX "TrustClaim_claimKey_idx" ON "TrustClaim"("claimKey");
