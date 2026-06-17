CREATE TABLE "TemplateGeneration" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "templateId" TEXT,
    "inputDescription" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "output" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TemplateGeneration_createdById_createdAt_idx" ON "TemplateGeneration"("createdById", "createdAt");
CREATE INDEX "TemplateGeneration_templateId_idx" ON "TemplateGeneration"("templateId");

ALTER TABLE "TemplateGeneration" ADD CONSTRAINT "TemplateGeneration_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemplateGeneration" ADD CONSTRAINT "TemplateGeneration_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "RelationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
