-- CreateEnum
CREATE TYPE "CredentialTypeStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "TrustedOrganizationStatus" AS ENUM ('PENDING', 'TRUSTED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('PERSON', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'SUSPENDED', 'REVOKED');

-- CreateTable
CREATE TABLE "CredentialType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CredentialTypeStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedOrganization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "TrustedOrganizationStatus" NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodissimaIdentity" (
    "id" TEXT NOT NULL,
    "type" "IdentityType" NOT NULL,
    "status" "IdentityStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodissimaIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CredentialType_code_key" ON "CredentialType"("code");

-- CreateIndex
CREATE INDEX "TrustedOrganization_organizationId_idx" ON "TrustedOrganization"("organizationId");

-- CreateIndex
CREATE INDEX "TrustedOrganization_status_idx" ON "TrustedOrganization"("status");
