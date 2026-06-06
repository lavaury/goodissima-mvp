-- CreateEnum
CREATE TYPE "TrustAdmissionTokenStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TrustAdmissionTokenPurpose" AS ENUM ('TRUST_ADMISSION');

-- CreateTable
CREATE TABLE "TrustAdmissionToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "gLinkId" TEXT,
    "purpose" "TrustAdmissionTokenPurpose" NOT NULL,
    "status" "TrustAdmissionTokenStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustAdmissionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustAdmissionToken_tokenHash_key" ON "TrustAdmissionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "TrustAdmissionToken_identityId_idx" ON "TrustAdmissionToken"("identityId");

-- CreateIndex
CREATE INDEX "TrustAdmissionToken_gLinkId_idx" ON "TrustAdmissionToken"("gLinkId");

-- CreateIndex
CREATE INDEX "TrustAdmissionToken_status_idx" ON "TrustAdmissionToken"("status");

-- CreateIndex
CREATE INDEX "TrustAdmissionToken_expiresAt_idx" ON "TrustAdmissionToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "TrustAdmissionToken" ADD CONSTRAINT "TrustAdmissionToken_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "GoodissimaIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAdmissionToken" ADD CONSTRAINT "TrustAdmissionToken_gLinkId_fkey" FOREIGN KEY ("gLinkId") REFERENCES "GLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
