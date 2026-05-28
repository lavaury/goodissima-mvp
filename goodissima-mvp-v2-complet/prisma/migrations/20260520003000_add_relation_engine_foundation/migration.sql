-- CreateTable
CREATE TABLE "RelationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "RelationCase" ADD COLUMN "templateId" TEXT;
ALTER TABLE "RelationCase" ADD COLUMN "currentStep" TEXT DEFAULT 'CONVERSATION';

-- CreateIndex
CREATE UNIQUE INDEX "RelationTemplate_key_key" ON "RelationTemplate"("key");

-- CreateIndex
CREATE INDEX "RelationEvent_caseId_createdAt_idx" ON "RelationEvent"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "RelationCase" ADD CONSTRAINT "RelationCase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RelationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationEvent" ADD CONSTRAINT "RelationEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RelationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default template and link existing cases.
INSERT INTO "RelationTemplate" ("id", "key", "name", "isDefault", "updatedAt")
VALUES ('rel_tpl_default_secure_conversation', 'DEFAULT_SECURE_CONVERSATION', 'Conversation sécurisée', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "name" = EXCLUDED."name",
    "isDefault" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "RelationCase"
SET "templateId" = (
    SELECT "id"
    FROM "RelationTemplate"
    WHERE "key" = 'DEFAULT_SECURE_CONVERSATION'
)
WHERE "templateId" IS NULL;
