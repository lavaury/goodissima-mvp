-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceKind') THEN
    CREATE TYPE "WorkspaceKind" AS ENUM ('GOVERNANCE', 'RELATION', 'MIXED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceStatus') THEN
    CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Workspace" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "WorkspaceKind" NOT NULL DEFAULT 'GOVERNANCE',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GLink" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "RelationCase" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "RelationTemplate" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_ownerId_slug_key" ON "Workspace"("ownerId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Workspace_ownerId_status_createdAt_idx" ON "Workspace"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Workspace_kind_status_idx" ON "Workspace"("kind", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GLink_workspaceId_idx" ON "GLink"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RelationCase_workspaceId_idx" ON "RelationCase"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RelationTemplate_workspaceId_idx" ON "RelationTemplate"("workspaceId");

-- Clear legacy metadata-only identifiers before enforcing real Workspace foreign keys.
UPDATE "GLink"
SET "workspaceId" = NULL
WHERE "workspaceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Workspace" WHERE "Workspace"."id" = "GLink"."workspaceId"
  );

UPDATE "RelationCase"
SET "workspaceId" = NULL
WHERE "workspaceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Workspace" WHERE "Workspace"."id" = "RelationCase"."workspaceId"
  );

UPDATE "RelationTemplate"
SET "workspaceId" = NULL
WHERE "workspaceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Workspace" WHERE "Workspace"."id" = "RelationTemplate"."workspaceId"
  );

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Workspace_ownerId_fkey') THEN
    ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GLink_workspaceId_fkey') THEN
    ALTER TABLE "GLink" ADD CONSTRAINT "GLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RelationCase_workspaceId_fkey') THEN
    ALTER TABLE "RelationCase" ADD CONSTRAINT "RelationCase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RelationTemplate_workspaceId_fkey') THEN
    ALTER TABLE "RelationTemplate" ADD CONSTRAINT "RelationTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
