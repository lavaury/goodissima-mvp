ALTER TABLE "CommunicationSession"
ADD COLUMN IF NOT EXISTS "metadata" JSONB;
