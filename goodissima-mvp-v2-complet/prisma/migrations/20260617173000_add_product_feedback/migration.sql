-- CreateEnum
CREATE TYPE "ProductFeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "ProductFeedback" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "role" TEXT,
    "userId" TEXT,
    "caseId" TEXT,
    "templateId" TEXT,
    "browserInfo" JSONB,
    "environment" TEXT,
    "status" "ProductFeedbackStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "adminNotes" TEXT,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFeedback_status_createdAt_idx" ON "ProductFeedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductFeedback_type_createdAt_idx" ON "ProductFeedback"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ProductFeedback_userId_idx" ON "ProductFeedback"("userId");

-- CreateIndex
CREATE INDEX "ProductFeedback_caseId_idx" ON "ProductFeedback"("caseId");

-- CreateIndex
CREATE INDEX "ProductFeedback_templateId_idx" ON "ProductFeedback"("templateId");

-- AddForeignKey
ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RelationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RelationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
