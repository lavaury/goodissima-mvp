-- Directory representations lot 1.
-- The legacy goodissima_* directory tables remain historical and outside runtime.

CREATE TYPE "RepresentationType" AS ENUM (
  'PROFESSIONAL',
  'ORGANIZATION_REPRESENTATIVE',
  'ASSOCIATION',
  'PRIVATE',
  'OTHER'
);

CREATE TYPE "RepresentationStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'ARCHIVED');

CREATE UNIQUE INDEX "User_id_goodissimaIdentityId_key"
  ON "User"("id", "goodissimaIdentityId");

CREATE TABLE "Representation" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "type" "RepresentationType" NOT NULL,
  "displayName" TEXT NOT NULL,
  "title" TEXT,
  "organizationName" TEXT,
  "description" TEXT,
  "territory" TEXT,
  "status" "RepresentationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Representation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Representation_archivedAt_check" CHECK (
    ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
    OR ("status" <> 'ARCHIVED' AND "archivedAt" IS NULL)
  )
);

CREATE INDEX "Representation_ownerId_status_idx" ON "Representation"("ownerId", "status");
CREATE INDEX "Representation_identityId_idx" ON "Representation"("identityId");
CREATE INDEX "Representation_ownerId_identityId_idx" ON "Representation"("ownerId", "identityId");
CREATE INDEX "Representation_ownerId_updatedAt_idx" ON "Representation"("ownerId", "updatedAt");

ALTER TABLE "Representation"
  ADD CONSTRAINT "Representation_ownerId_identityId_fkey"
  FOREIGN KEY ("ownerId", "identityId")
  REFERENCES "User"("id", "goodissimaIdentityId")
  ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "Representation"
  ADD CONSTRAINT "Representation_identityId_fkey"
  FOREIGN KEY ("identityId")
  REFERENCES "GoodissimaIdentity"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Server-side Prisma remains responsible for ownerId scoping. With no browser
-- policy, Supabase anon/authenticated clients cannot read or mutate this table.
ALTER TABLE "Representation" ENABLE ROW LEVEL SECURITY;
