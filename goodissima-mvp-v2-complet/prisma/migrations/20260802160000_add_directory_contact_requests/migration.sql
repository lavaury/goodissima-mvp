CREATE TYPE "ContactRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED', 'DEFERRED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "ContactRequestChannel" AS ENUM ('MESSAGE', 'VOICE', 'VIDEO');
CREATE TYPE "ContactRequestEventType" AS ENUM ('CREATED', 'VIEWED_BY_TARGET', 'ACCEPTED', 'REFUSED', 'DEFERRED', 'RESUMED', 'CANCELLED', 'EXPIRED');

CREATE UNIQUE INDEX "Representation_id_ownerId_key" ON "Representation"("id", "ownerId");

CREATE TABLE "ContactRequest" (
  "id" TEXT NOT NULL,
  "requesterOwnerId" TEXT NOT NULL,
  "requesterRepresentationId" TEXT NOT NULL,
  "targetOwnerId" TEXT NOT NULL,
  "targetRepresentationId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "contextType" TEXT,
  "contextId" TEXT,
  "status" "ContactRequestStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "deferredUntil" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactRequest_distinct_owners_check" CHECK ("requesterOwnerId" <> "targetOwnerId"),
  CONSTRAINT "ContactRequest_distinct_representations_check" CHECK ("requesterRepresentationId" <> "targetRepresentationId"),
  CONSTRAINT "ContactRequest_deferred_date_check" CHECK (("status" = 'DEFERRED') = ("deferredUntil" IS NOT NULL)),
  CONSTRAINT "ContactRequest_cancelled_date_check" CHECK (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL))
);
CREATE TABLE "ContactRequestRequestedChannel" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "channel" "ContactRequestChannel" NOT NULL,
  CONSTRAINT "ContactRequestRequestedChannel_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContactRequestEvent" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "actorUserId" TEXT, "type" "ContactRequestEventType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactRequestEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactRequest_targetOwnerId_status_createdAt_idx" ON "ContactRequest"("targetOwnerId", "status", "createdAt");
CREATE INDEX "ContactRequest_requesterOwnerId_status_createdAt_idx" ON "ContactRequest"("requesterOwnerId", "status", "createdAt");
CREATE INDEX "ContactRequest_requesterRepresentationId_targetRepresentationId_status_idx" ON "ContactRequest"("requesterRepresentationId", "targetRepresentationId", "status");
CREATE INDEX "ContactRequest_expiresAt_status_idx" ON "ContactRequest"("expiresAt", "status");
CREATE UNIQUE INDEX "ContactRequestRequestedChannel_requestId_channel_key" ON "ContactRequestRequestedChannel"("requestId", "channel");
CREATE INDEX "ContactRequestRequestedChannel_requestId_idx" ON "ContactRequestRequestedChannel"("requestId");
CREATE INDEX "ContactRequestEvent_requestId_createdAt_idx" ON "ContactRequestEvent"("requestId", "createdAt");
CREATE UNIQUE INDEX "ContactRequestEvent_first_target_view_key" ON "ContactRequestEvent"("requestId", "type") WHERE "type" = 'VIEWED_BY_TARGET';
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_requesterOwnerId_fkey" FOREIGN KEY ("requesterOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_targetOwnerId_fkey" FOREIGN KEY ("targetOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_requesterRepresentationId_requesterOwnerId_fkey" FOREIGN KEY ("requesterRepresentationId", "requesterOwnerId") REFERENCES "Representation"("id", "ownerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_targetRepresentationId_targetOwnerId_fkey" FOREIGN KEY ("targetRepresentationId", "targetOwnerId") REFERENCES "Representation"("id", "ownerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ContactRequestRequestedChannel" ADD CONSTRAINT "ContactRequestRequestedChannel_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ContactRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactRequestEvent" ADD CONSTRAINT "ContactRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ContactRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactRequestEvent" ADD CONSTRAINT "ContactRequestEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma server reads remain owner-scoped. Browser roles have no direct policy.
ALTER TABLE "ContactRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactRequestRequestedChannel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactRequestEvent" ENABLE ROW LEVEL SECURITY;
