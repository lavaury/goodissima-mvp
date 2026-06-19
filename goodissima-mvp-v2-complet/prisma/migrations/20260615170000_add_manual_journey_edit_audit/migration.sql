CREATE TABLE "ManualTemplateEditAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "newVersionId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "changedFields" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualTemplateEditAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualTemplateEditAudit_newVersionId_key" ON "ManualTemplateEditAudit"("newVersionId");
CREATE INDEX "ManualTemplateEditAudit_userId_createdAt_idx" ON "ManualTemplateEditAudit"("userId", "createdAt");
CREATE INDEX "ManualTemplateEditAudit_sourceVersionId_createdAt_idx" ON "ManualTemplateEditAudit"("sourceVersionId", "createdAt");

ALTER TABLE "ManualTemplateEditAudit" ADD CONSTRAINT "ManualTemplateEditAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualTemplateEditAudit" ADD CONSTRAINT "ManualTemplateEditAudit_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "TemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualTemplateEditAudit" ADD CONSTRAINT "ManualTemplateEditAudit_newVersionId_fkey" FOREIGN KEY ("newVersionId") REFERENCES "TemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
