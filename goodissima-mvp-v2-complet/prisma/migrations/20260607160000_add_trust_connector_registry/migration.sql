-- CreateEnum
CREATE TYPE "TrustConnectorStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "TrustConnectorProviderType" AS ENUM ('DEMO', 'GOVERNMENT', 'EUROPEAN_WALLET', 'BANK', 'INSURANCE', 'EDUCATION', 'PROFESSIONAL_BODY', 'OTHER');

-- CreateTable
CREATE TABLE "TrustConnector" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TrustConnectorStatus" NOT NULL,
    "providerType" "TrustConnectorProviderType" NOT NULL,
    "trustedOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustConnector_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrustConnector_trustedOrganizationId_fkey" FOREIGN KEY ("trustedOrganizationId") REFERENCES "TrustedOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustConnector_code_key" ON "TrustConnector"("code");

-- CreateIndex
CREATE INDEX "TrustConnector_status_idx" ON "TrustConnector"("status");

-- CreateIndex
CREATE INDEX "TrustConnector_providerType_idx" ON "TrustConnector"("providerType");

-- CreateIndex
CREATE INDEX "TrustConnector_trustedOrganizationId_idx" ON "TrustConnector"("trustedOrganizationId");
