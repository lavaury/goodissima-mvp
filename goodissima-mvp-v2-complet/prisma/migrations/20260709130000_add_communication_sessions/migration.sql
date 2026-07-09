-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunicationChannelType') THEN
    CREATE TYPE "CommunicationChannelType" AS ENUM ('VOICE_IP', 'VIDEO_IP', 'SCREEN_SHARE');
  END IF;
END $$;

ALTER TYPE "CommunicationChannelType" ADD VALUE IF NOT EXISTS 'VOICE_IP';
ALTER TYPE "CommunicationChannelType" ADD VALUE IF NOT EXISTS 'VIDEO_IP';
ALTER TYPE "CommunicationChannelType" ADD VALUE IF NOT EXISTS 'SCREEN_SHARE';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunicationSessionStatus') THEN
    CREATE TYPE "CommunicationSessionStatus" AS ENUM ('REQUESTED', 'PREPARED_NOT_STARTED', 'CANCELLED', 'COMPLETED');
  END IF;
END $$;

ALTER TYPE "CommunicationSessionStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "CommunicationSessionStatus" ADD VALUE IF NOT EXISTS 'PREPARED_NOT_STARTED';
ALTER TYPE "CommunicationSessionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "CommunicationSessionStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunicationProvider') THEN
    CREATE TYPE "CommunicationProvider" AS ENUM ('NONE', 'MANUAL_EXTERNAL', 'LIVEKIT_PENDING');
  END IF;
END $$;

ALTER TYPE "CommunicationProvider" ADD VALUE IF NOT EXISTS 'NONE';
ALTER TYPE "CommunicationProvider" ADD VALUE IF NOT EXISTS 'MANUAL_EXTERNAL';
ALTER TYPE "CommunicationProvider" ADD VALUE IF NOT EXISTS 'LIVEKIT_PENDING';

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommunicationSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "relationTemplateId" TEXT,
    "relationCaseId" TEXT,
    "channelType" "CommunicationChannelType" NOT NULL,
    "provider" "CommunicationProvider" NOT NULL,
    "status" "CommunicationSessionStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "note" TEXT,
    "externalUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "transcriptionRequested" BOOLEAN NOT NULL DEFAULT false,
    "transcriptionConsented" BOOLEAN NOT NULL DEFAULT false,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "automaticNotificationSent" BOOLEAN NOT NULL DEFAULT false,
    "tokenGenerated" BOOLEAN NOT NULL DEFAULT false,
    "accessOpened" BOOLEAN NOT NULL DEFAULT false,
    "workflowStarted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunicationSession_ownerId_status_createdAt_idx" ON "CommunicationSession"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunicationSession_workspaceId_status_idx" ON "CommunicationSession"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunicationSession_relationTemplateId_status_idx" ON "CommunicationSession"("relationTemplateId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunicationSession_relationCaseId_status_idx" ON "CommunicationSession"("relationCaseId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunicationSession_channelType_status_idx" ON "CommunicationSession"("channelType", "status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunicationSession_ownerId_fkey') THEN
    ALTER TABLE "CommunicationSession" ADD CONSTRAINT "CommunicationSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunicationSession_workspaceId_fkey') THEN
    ALTER TABLE "CommunicationSession" ADD CONSTRAINT "CommunicationSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunicationSession_relationTemplateId_fkey') THEN
    ALTER TABLE "CommunicationSession" ADD CONSTRAINT "CommunicationSession_relationTemplateId_fkey" FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunicationSession_relationCaseId_fkey') THEN
    ALTER TABLE "CommunicationSession" ADD CONSTRAINT "CommunicationSession_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
