ALTER TABLE "AIEvent"
ADD COLUMN "userId" TEXT,
ADD COLUMN "templateId" TEXT,
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "organizationName" TEXT,
ADD COLUMN "featureName" TEXT,
ADD COLUMN "promptTokens" INTEGER,
ADD COLUMN "completionTokens" INTEGER;

ALTER TABLE "TemplateGeneration" ADD COLUMN "aiEventId" TEXT;

CREATE UNIQUE INDEX "TemplateGeneration_aiEventId_key" ON "TemplateGeneration"("aiEventId");
CREATE INDEX "AIEvent_userId_createdAt_idx" ON "AIEvent"("userId", "createdAt");
CREATE INDEX "AIEvent_organizationId_createdAt_idx" ON "AIEvent"("organizationId", "createdAt");
CREATE INDEX "AIEvent_featureName_createdAt_idx" ON "AIEvent"("featureName", "createdAt");
CREATE INDEX "AIEvent_templateId_createdAt_idx" ON "AIEvent"("templateId", "createdAt");

ALTER TABLE "AIEvent" ADD CONSTRAINT "AIEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIEvent" ADD CONSTRAINT "AIEvent_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "RelationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TemplateGeneration" ADD CONSTRAINT "TemplateGeneration_aiEventId_fkey"
FOREIGN KEY ("aiEventId") REFERENCES "AIEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
