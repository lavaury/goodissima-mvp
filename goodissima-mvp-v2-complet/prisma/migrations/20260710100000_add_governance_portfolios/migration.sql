-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PortfolioKind') THEN
    CREATE TYPE "PortfolioKind" AS ENUM ('JUDICIAL', 'PROFESSIONAL', 'ASSOCIATION', 'FAMILY', 'PROJECT', 'PERSONAL', 'OTHER');
  END IF;
END $$;

ALTER TYPE "PortfolioKind" ADD VALUE IF NOT EXISTS 'JUDICIAL';
ALTER TYPE "PortfolioKind" ADD VALUE IF NOT EXISTS 'PROFESSIONAL';
ALTER TYPE "PortfolioKind" ADD VALUE IF NOT EXISTS 'ASSOCIATION';
ALTER TYPE "PortfolioKind" ADD VALUE IF NOT EXISTS 'FAMILY';
ALTER TYPE "PortfolioKind" ADD VALUE IF NOT EXISTS 'PROJECT';
ALTER TYPE "PortfolioKind" ADD VALUE IF NOT EXISTS 'PERSONAL';
ALTER TYPE "PortfolioKind" ADD VALUE IF NOT EXISTS 'OTHER';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PortfolioStatus') THEN
    CREATE TYPE "PortfolioStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
  END IF;
END $$;

ALTER TYPE "PortfolioStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "PortfolioStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Portfolio" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PortfolioKind" NOT NULL DEFAULT 'OTHER',
    "status" "PortfolioStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "portfolioId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Portfolio_ownerId_slug_key" ON "Portfolio"("ownerId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Portfolio_ownerId_status_createdAt_idx" ON "Portfolio"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Portfolio_ownerId_kind_status_idx" ON "Portfolio"("ownerId", "kind", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Workspace_portfolioId_idx" ON "Workspace"("portfolioId");

-- Clear invalid portfolio references before enforcing foreign keys.
UPDATE "Workspace"
SET "portfolioId" = NULL
WHERE "portfolioId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Portfolio" WHERE "Portfolio"."id" = "Workspace"."portfolioId"
  );

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Portfolio_ownerId_fkey') THEN
    ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Workspace_portfolioId_fkey') THEN
    ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
