-- CreateEnum
CREATE TYPE "DirectoryActorType" AS ENUM ('PERSON', 'ORGANIZATION');
CREATE TYPE "DirectoryProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISABLED');
CREATE TYPE "DirectoryManagerRole" AS ENUM ('OWNER', 'EDITOR');
CREATE TYPE "DirectoryAttributeKind" AS ENUM ('PROFESSION', 'SKILL', 'LANGUAGE', 'LOCATION', 'QUALIFICATION', 'CERTIFICATION', 'ORGANIZATION_DOMAIN');
CREATE TYPE "DirectoryPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHDRAWN');
CREATE TYPE "DirectoryTrustLevel" AS ENUM ('DECLARED', 'VERIFIED');
CREATE TYPE "DirectoryLocationGranularity" AS ENUM ('COUNTRY', 'REGION', 'CITY');
CREATE TYPE "DirectoryVerificationState" AS ENUM ('VALID', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'INVALID');
CREATE TYPE "DirectoryVerificationLossPolicy" AS ENUM ('KEEP_AS_DECLARED', 'WITHDRAW');
CREATE TYPE "DirectoryAuditAction" AS ENUM ('PROFILE_CREATED', 'PROFILE_PUBLISHED', 'PROFILE_DISABLED', 'PROFILE_REPUBLISHED', 'PROFILE_DELETED', 'ATTRIBUTE_ADDED', 'ATTRIBUTE_PUBLISHED', 'ATTRIBUTE_UPDATED', 'ATTRIBUTE_WITHDRAWN', 'VERIFICATION_ATTACHED', 'VERIFICATION_DOWNGRADED', 'MANAGER_ADDED', 'MANAGER_REMOVED');

-- CreateTable
CREATE TABLE "DirectoryProfile" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "subjectIdentityId" TEXT NOT NULL,
    "actorType" "DirectoryActorType" NOT NULL,
    "status" "DirectoryProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "publicName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectoryProfileManager" (
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "DirectoryManagerRole" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "grantedById" TEXT,

    CONSTRAINT "DirectoryProfileManager_pkey" PRIMARY KEY ("profileId", "userId")
);

CREATE TABLE "DirectoryAttribute" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "DirectoryAttributeKind" NOT NULL,
    "displayValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "code" TEXT,
    "locale" TEXT,
    "locationGranularity" "DirectoryLocationGranularity",
    "publicationStatus" "DirectoryPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "declaredTrustLevel" "DirectoryTrustLevel" NOT NULL DEFAULT 'DECLARED',
    "verificationLossPolicy" "DirectoryVerificationLossPolicy" NOT NULL DEFAULT 'KEEP_AS_DECLARED',
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryAttribute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectoryVerificationProvenance" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "claimId" TEXT,
    "state" "DirectoryVerificationState" NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryVerificationProvenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectoryAuditEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "actorUserId" TEXT,
    "action" "DirectoryAuditAction" NOT NULL,
    "attributeId" TEXT,
    "attributeKind" "DirectoryAttributeKind",
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectoryAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryProfile_publicId_key" ON "DirectoryProfile"("publicId");
CREATE UNIQUE INDEX "DirectoryProfile_subjectIdentityId_key" ON "DirectoryProfile"("subjectIdentityId");
CREATE INDEX "DirectoryProfile_status_actorType_publishedAt_id_idx" ON "DirectoryProfile"("status", "actorType", "publishedAt", "id");
CREATE INDEX "DirectoryProfile_actorType_status_normalizedName_idx" ON "DirectoryProfile"("actorType", "status", "normalizedName");
CREATE INDEX "DirectoryProfileManager_userId_revokedAt_idx" ON "DirectoryProfileManager"("userId", "revokedAt");
CREATE INDEX "DirectoryAttribute_profileId_publicationStatus_kind_idx" ON "DirectoryAttribute"("profileId", "publicationStatus", "kind");
CREATE INDEX "DirectoryAttribute_kind_normalizedValue_publicationStatus_profileId_idx" ON "DirectoryAttribute"("kind", "normalizedValue", "publicationStatus", "profileId");
CREATE INDEX "DirectoryAttribute_kind_code_publicationStatus_profileId_idx" ON "DirectoryAttribute"("kind", "code", "publicationStatus", "profileId");
CREATE UNIQUE INDEX "DirectoryVerificationProvenance_attributeId_key" ON "DirectoryVerificationProvenance"("attributeId");
CREATE INDEX "DirectoryVerificationProvenance_state_validUntil_attributeId_idx" ON "DirectoryVerificationProvenance"("state", "validUntil", "attributeId");
CREATE INDEX "DirectoryVerificationProvenance_credentialId_state_idx" ON "DirectoryVerificationProvenance"("credentialId", "state");
CREATE INDEX "DirectoryAuditEvent_profileId_occurredAt_idx" ON "DirectoryAuditEvent"("profileId", "occurredAt");
CREATE INDEX "DirectoryAuditEvent_actorUserId_occurredAt_idx" ON "DirectoryAuditEvent"("actorUserId", "occurredAt");

-- AddForeignKey
ALTER TABLE "DirectoryProfile" ADD CONSTRAINT "DirectoryProfile_subjectIdentityId_fkey" FOREIGN KEY ("subjectIdentityId") REFERENCES "GoodissimaIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectoryProfileManager" ADD CONSTRAINT "DirectoryProfileManager_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DirectoryProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectoryProfileManager" ADD CONSTRAINT "DirectoryProfileManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectoryAttribute" ADD CONSTRAINT "DirectoryAttribute_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DirectoryProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectoryVerificationProvenance" ADD CONSTRAINT "DirectoryVerificationProvenance_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "DirectoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectoryVerificationProvenance" ADD CONSTRAINT "DirectoryVerificationProvenance_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "TrustCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DirectoryVerificationProvenance" ADD CONSTRAINT "DirectoryVerificationProvenance_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "TrustClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DirectoryAuditEvent" ADD CONSTRAINT "DirectoryAuditEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DirectoryProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep browser roles denied by default. No RLS policies or business permissions
-- are introduced by this foundation migration.
ALTER TABLE "DirectoryProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectoryProfileManager" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectoryAttribute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectoryVerificationProvenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectoryAuditEvent" ENABLE ROW LEVEL SECURITY;
