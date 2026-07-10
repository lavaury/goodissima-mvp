ALTER TABLE "GLink" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "RelationCase" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "RelationTemplate" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

CREATE INDEX IF NOT EXISTS "GLink_workspaceId_idx" ON "GLink"("workspaceId");
CREATE INDEX IF NOT EXISTS "RelationCase_workspaceId_idx" ON "RelationCase"("workspaceId");
CREATE INDEX IF NOT EXISTS "RelationTemplate_workspaceId_idx" ON "RelationTemplate"("workspaceId");
