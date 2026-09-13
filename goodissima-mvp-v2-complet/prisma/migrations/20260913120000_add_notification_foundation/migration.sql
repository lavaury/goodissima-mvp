-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_RELATION_CASE', 'NEW_MESSAGE');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "relationCaseId" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_relationCaseId_idx" ON "Notification"("relationCaseId");

-- CreateIndex
CREATE INDEX "Notification_sourceEventId_idx" ON "Notification"("sourceEventId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "RelationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
