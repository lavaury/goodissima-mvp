-- CreateEnum
CREATE TYPE "IdruSubjectStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'MERGED_ALIAS');

-- CreateEnum
CREATE TYPE "SubjectPresenceType" AS ENUM ('GOODISSIMA_IDENTITY');

-- CreateEnum
CREATE TYPE "SubjectPresenceState" AS ENUM ('ACTIVE', 'DETACHED');

-- CreateEnum
CREATE TYPE "IdentityResolutionResult" AS ENUM ('RESOLVED', 'UNRESOLVED', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "IdentityResolutionMethod" AS ENUM ('BACKFILL', 'MANUAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "RelationalSubject" (
    "id" TEXT NOT NULL,
    "idru" TEXT NOT NULL,
    "type" "IdentityType" NOT NULL,
    "state" "IdruSubjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelationalSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectPresence" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "presenceType" "SubjectPresenceType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "state" "SubjectPresenceState" NOT NULL DEFAULT 'ACTIVE',
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityResolution" (
    "id" TEXT NOT NULL,
    "presenceId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "result" "IdentityResolutionResult" NOT NULL,
    "method" "IdentityResolutionMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionAudit" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolutionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelationalSubject_idru_key" ON "RelationalSubject"("idru");

-- CreateIndex
CREATE INDEX "RelationalSubject_type_state_idx" ON "RelationalSubject"("type", "state");

-- CreateIndex
CREATE INDEX "RelationalSubject_createdAt_idx" ON "RelationalSubject"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectPresence_presenceType_sourceType_sourceId_key" ON "SubjectPresence"("presenceType", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "SubjectPresence_subjectId_idx" ON "SubjectPresence"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectPresence_presenceType_state_idx" ON "SubjectPresence"("presenceType", "state");

-- CreateIndex
CREATE INDEX "SubjectPresence_createdAt_idx" ON "SubjectPresence"("createdAt");

-- CreateIndex
CREATE INDEX "IdentityResolution_presenceId_createdAt_idx" ON "IdentityResolution"("presenceId", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityResolution_subjectId_createdAt_idx" ON "IdentityResolution"("subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityResolution_result_createdAt_idx" ON "IdentityResolution"("result", "createdAt");

-- CreateIndex
CREATE INDEX "ResolutionAudit_resolutionId_createdAt_idx" ON "ResolutionAudit"("resolutionId", "createdAt");

-- CreateIndex
CREATE INDEX "ResolutionAudit_eventType_createdAt_idx" ON "ResolutionAudit"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "SubjectPresence" ADD CONSTRAINT "SubjectPresence_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "RelationalSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityResolution" ADD CONSTRAINT "IdentityResolution_presenceId_fkey" FOREIGN KEY ("presenceId") REFERENCES "SubjectPresence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityResolution" ADD CONSTRAINT "IdentityResolution_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "RelationalSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionAudit" ADD CONSTRAINT "ResolutionAudit_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "IdentityResolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Protect IDRU tables from direct Supabase browser access.
-- No policies are added; server-side Prisma access remains available.
ALTER TABLE "RelationalSubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubjectPresence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdentityResolution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResolutionAudit" ENABLE ROW LEVEL SECURITY;
