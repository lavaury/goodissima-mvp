CREATE TABLE "TemplateOptimization" (
    "id" TEXT NOT NULL,
    "criticReportId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "draftVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "optimizerVersion" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "originalScore" INTEGER NOT NULL,
    "projectedScore" INTEGER NOT NULL,
    "proposal" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateOptimization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplateOptimization_draftVersionId_key" ON "TemplateOptimization"("draftVersionId");
CREATE INDEX "TemplateOptimization_criticReportId_createdAt_idx" ON "TemplateOptimization"("criticReportId", "createdAt");
CREATE INDEX "TemplateOptimization_sourceVersionId_createdAt_idx" ON "TemplateOptimization"("sourceVersionId", "createdAt");
CREATE INDEX "TemplateOptimization_createdById_createdAt_idx" ON "TemplateOptimization"("createdById", "createdAt");

ALTER TABLE "TemplateOptimization" ADD CONSTRAINT "TemplateOptimization_criticReportId_fkey"
FOREIGN KEY ("criticReportId") REFERENCES "TemplateCriticReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateOptimization" ADD CONSTRAINT "TemplateOptimization_sourceVersionId_fkey"
FOREIGN KEY ("sourceVersionId") REFERENCES "TemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateOptimization" ADD CONSTRAINT "TemplateOptimization_draftVersionId_fkey"
FOREIGN KEY ("draftVersionId") REFERENCES "TemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TemplateOptimization" ADD CONSTRAINT "TemplateOptimization_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
