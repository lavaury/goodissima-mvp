CREATE TYPE "RepresentationContactStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'REVOKED');
CREATE TYPE "RepresentationContactEventType" AS ENUM ('CREATED', 'ARCHIVED', 'RESTORED');

ALTER TABLE "ContactRequest" ADD COLUMN "contactCreatedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "ContactRequest_id_requesterRepresentationId_targetRepresentationId_key"
  ON "ContactRequest"("id", "requesterRepresentationId", "targetRepresentationId");

CREATE TABLE "RepresentationContact" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "ownerRepresentationId" TEXT NOT NULL,
  "contactRepresentationId" TEXT NOT NULL,
  "sourceContactRequestId" TEXT NOT NULL,
  "sourceRequesterRepresentationId" TEXT NOT NULL,
  "sourceTargetRepresentationId" TEXT NOT NULL,
  "status" "RepresentationContactStatus" NOT NULL DEFAULT 'ACTIVE',
  "snapshotDisplayName" TEXT NOT NULL,
  "snapshotType" "RepresentationType" NOT NULL,
  "snapshotTitle" TEXT,
  "snapshotOrganizationName" TEXT,
  "snapshotTerritory" TEXT,
  "snapshotDescription" TEXT,
  "snapshotRelationshipPolicy" "RepresentationRelationshipPolicy" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "RepresentationContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepresentationContact_distinct_representations_check" CHECK ("ownerRepresentationId" <> "contactRepresentationId"),
  CONSTRAINT "RepresentationContact_orientation_check" CHECK (
    ("ownerRepresentationId" = "sourceRequesterRepresentationId" AND "contactRepresentationId" = "sourceTargetRepresentationId")
    OR
    ("ownerRepresentationId" = "sourceTargetRepresentationId" AND "contactRepresentationId" = "sourceRequesterRepresentationId")
  ),
  CONSTRAINT "RepresentationContact_archivedAt_check" CHECK (
    ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
    OR ("status" <> 'ARCHIVED' AND "archivedAt" IS NULL)
  )
);

CREATE TABLE "RepresentationContactEvent" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" "RepresentationContactEventType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepresentationContactEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RepresentationContact_sourceContactRequestId_ownerId_key" ON "RepresentationContact"("sourceContactRequestId", "ownerId");
CREATE INDEX "RepresentationContact_ownerId_status_updatedAt_idx" ON "RepresentationContact"("ownerId", "status", "updatedAt");
CREATE INDEX "RepresentationContact_ownerRepresentationId_idx" ON "RepresentationContact"("ownerRepresentationId");
CREATE INDEX "RepresentationContact_contactRepresentationId_idx" ON "RepresentationContact"("contactRepresentationId");
CREATE UNIQUE INDEX "RepresentationContact_active_direction_key" ON "RepresentationContact"("ownerId", "ownerRepresentationId", "contactRepresentationId") WHERE "status" = 'ACTIVE';
CREATE INDEX "RepresentationContactEvent_contactId_createdAt_idx" ON "RepresentationContactEvent"("contactId", "createdAt");

ALTER TABLE "RepresentationContact" ADD CONSTRAINT "RepresentationContact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepresentationContact" ADD CONSTRAINT "RepresentationContact_ownerRepresentationId_ownerId_fkey" FOREIGN KEY ("ownerRepresentationId", "ownerId") REFERENCES "Representation"("id", "ownerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "RepresentationContact" ADD CONSTRAINT "RepresentationContact_contactRepresentationId_fkey" FOREIGN KEY ("contactRepresentationId") REFERENCES "Representation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "RepresentationContact" ADD CONSTRAINT "RepresentationContact_sourceContactRequest_fkey" FOREIGN KEY ("sourceContactRequestId", "sourceRequesterRepresentationId", "sourceTargetRepresentationId") REFERENCES "ContactRequest"("id", "requesterRepresentationId", "targetRepresentationId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "RepresentationContactEvent" ADD CONSTRAINT "RepresentationContactEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "RepresentationContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepresentationContactEvent" ADD CONSTRAINT "RepresentationContactEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RepresentationContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RepresentationContactEvent" ENABLE ROW LEVEL SECURITY;
