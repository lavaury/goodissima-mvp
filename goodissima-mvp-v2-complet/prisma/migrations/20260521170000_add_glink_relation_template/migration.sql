-- AlterTable
ALTER TABLE "GLink" ADD COLUMN "templateId" TEXT;

-- Backfill existing links to the default secure conversation template.
UPDATE "GLink"
SET "templateId" = (
    SELECT "id"
    FROM "RelationTemplate"
    WHERE "key" = 'DEFAULT_SECURE_CONVERSATION'
)
WHERE "templateId" IS NULL;

-- AddForeignKey
ALTER TABLE "GLink" ADD CONSTRAINT "GLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RelationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
