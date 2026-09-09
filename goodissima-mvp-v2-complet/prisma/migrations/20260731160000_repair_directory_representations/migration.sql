-- Repair a drifted database where the original directory migration is recorded
-- but one or more physical Representation objects are absent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'RepresentationType'
  ) THEN
    CREATE TYPE public."RepresentationType" AS ENUM (
      'PROFESSIONAL',
      'ORGANIZATION_REPRESENTATIVE',
      'ASSOCIATION',
      'PRIVATE',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'RepresentationStatus'
  ) THEN
    CREATE TYPE public."RepresentationStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'ARCHIVED');
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_id_goodissimaIdentityId_key"
  ON public."User"("id", "goodissimaIdentityId");

CREATE TABLE IF NOT EXISTS public."Representation" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "type" public."RepresentationType" NOT NULL,
  "displayName" TEXT NOT NULL,
  "title" TEXT,
  "organizationName" TEXT,
  "description" TEXT,
  "territory" TEXT,
  "status" public."RepresentationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Representation"'::regclass
      AND conname = 'Representation_pkey'
  ) THEN
    ALTER TABLE public."Representation"
      ADD CONSTRAINT "Representation_pkey" PRIMARY KEY ("id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Representation"'::regclass
      AND conname = 'Representation_archivedAt_check'
  ) THEN
    ALTER TABLE public."Representation"
      ADD CONSTRAINT "Representation_archivedAt_check" CHECK (
        ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
        OR ("status" <> 'ARCHIVED' AND "archivedAt" IS NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Representation"'::regclass
      AND conname = 'Representation_ownerId_identityId_fkey'
  ) THEN
    ALTER TABLE public."Representation"
      ADD CONSTRAINT "Representation_ownerId_identityId_fkey"
      FOREIGN KEY ("ownerId", "identityId")
      REFERENCES public."User"("id", "goodissimaIdentityId")
      ON DELETE CASCADE ON UPDATE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Representation"'::regclass
      AND conname = 'Representation_identityId_fkey'
  ) THEN
    ALTER TABLE public."Representation"
      ADD CONSTRAINT "Representation_identityId_fkey"
      FOREIGN KEY ("identityId")
      REFERENCES public."GoodissimaIdentity"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Representation_ownerId_status_idx"
  ON public."Representation"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "Representation_identityId_idx"
  ON public."Representation"("identityId");
CREATE INDEX IF NOT EXISTS "Representation_ownerId_identityId_idx"
  ON public."Representation"("ownerId", "identityId");
CREATE INDEX IF NOT EXISTS "Representation_ownerId_updatedAt_idx"
  ON public."Representation"("ownerId", "updatedAt");

-- Idempotent: keeps browser access denied by default when no RLS policy exists.
ALTER TABLE public."Representation" ENABLE ROW LEVEL SECURITY;
