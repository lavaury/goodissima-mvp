-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceCategory') THEN
    CREATE TYPE "WorkspaceCategory" AS ENUM ('PROFESSIONAL', 'PRIVATE', 'FAMILY', 'ASSOCIATION', 'PROJECT', 'CLIENT', 'OTHER');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "category" "WorkspaceCategory" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Workspace_ownerId_category_status_idx" ON "Workspace"("ownerId", "category", "status");
