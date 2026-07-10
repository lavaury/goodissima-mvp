-- CreateEnum
CREATE TYPE "SubjectObservationEventType" AS ENUM (
    'IDENTITY_CREATED',
    'IDENTITY_LINKED',
    'CREDENTIAL_ISSUED',
    'CREDENTIAL_REVOKED',
    'ADMISSION_GRANTED',
    'ADMISSION_REVOKED'
);

-- CreateTable
CREATE TABLE "SubjectObservationEvent" (
    "id" TEXT NOT NULL,
    "eventType" "SubjectObservationEventType" NOT NULL,
    "subjectId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectObservationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectObservationEvent_createdAt_idx" ON "SubjectObservationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SubjectObservationEvent_eventType_createdAt_idx" ON "SubjectObservationEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SubjectObservationEvent_subjectId_createdAt_idx" ON "SubjectObservationEvent"("subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "SubjectObservationEvent_sourceType_sourceId_idx" ON "SubjectObservationEvent"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "SubjectObservationEvent" ADD CONSTRAINT "SubjectObservationEvent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "RelationalSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Protect the append-only observation journal from direct browser access.
-- No RLS policy is added; server-side Prisma access remains available.
ALTER TABLE "SubjectObservationEvent" ENABLE ROW LEVEL SECURITY;
