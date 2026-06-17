CREATE TABLE "TemplateCriticReport" (
    "id" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "criticVersion" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateCriticReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TemplateCriticReport_templateVersionId_createdAt_idx" ON "TemplateCriticReport"("templateVersionId", "createdAt");
CREATE INDEX "TemplateCriticReport_createdById_createdAt_idx" ON "TemplateCriticReport"("createdById", "createdAt");

ALTER TABLE "TemplateCriticReport" ADD CONSTRAINT "TemplateCriticReport_templateVersionId_fkey"
FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemplateCriticReport" ADD CONSTRAINT "TemplateCriticReport_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
