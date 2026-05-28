-- AlterTable
ALTER TABLE "FormField" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FormTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RelationTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RelationAction" (
    "id" TEXT NOT NULL,
    "relationCaseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB,
    "createdByRole" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelationAction_relationCaseId_status_idx" ON "RelationAction"("relationCaseId", "status");

-- CreateIndex
CREATE INDEX "RelationAction_relationCaseId_createdAt_idx" ON "RelationAction"("relationCaseId", "createdAt");

-- AddForeignKey
ALTER TABLE "RelationAction" ADD CONSTRAINT "RelationAction_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
