-- CreateTable
CREATE TABLE "ProductFeedbackAttachment" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "annotation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedbackAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFeedbackAttachment_feedbackId_idx" ON "ProductFeedbackAttachment"("feedbackId");

-- CreateIndex
CREATE INDEX "ProductFeedbackAttachment_createdAt_idx" ON "ProductFeedbackAttachment"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductFeedbackAttachment" ADD CONSTRAINT "ProductFeedbackAttachment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "ProductFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
