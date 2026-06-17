ALTER TABLE "TemplateGeneration"
ADD COLUMN "parentGenerationId" TEXT,
ADD COLUMN "proposalVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "revisionFeedback" TEXT,
ADD COLUMN "changes" JSONB;

CREATE INDEX "TemplateGeneration_parentGenerationId_idx" ON "TemplateGeneration"("parentGenerationId");

ALTER TABLE "TemplateGeneration" ADD CONSTRAINT "TemplateGeneration_parentGenerationId_fkey"
FOREIGN KEY ("parentGenerationId") REFERENCES "TemplateGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
