-- Goodissima MVP persistence, Sprint 9.
-- This migration prepares durable storage for the validated mock state model.

CREATE TYPE "GoodissimaRequestStatus" AS ENUM ('Draft', 'Submitted', 'Viewed', 'Accepted', 'Refused', 'Cancelled', 'Expired');
CREATE TYPE "GoodissimaRelationStatus" AS ENUM ('Pending', 'Active', 'Paused', 'Archived', 'Deleted');
CREATE TYPE "GoodissimaChannelStatus" AS ENUM ('Requested', 'Authorized', 'Scheduled', 'Expiring', 'Expired', 'Revoked');
CREATE TYPE "GoodissimaChannelType" AS ENUM ('Message', 'Appel audio', 'Documents', 'Visio');
CREATE TYPE "GoodissimaEntryDoorStatus" AS ENUM ('Inactive', 'Active', 'Suspended', 'Archived');
CREATE TYPE "GoodissimaPauseStatus" AS ENUM ('Inactive', 'Scheduled', 'Active', 'Ended');
CREATE TYPE "GoodissimaHistoryEventType" AS ENUM (
  'REQUEST_CREATED',
  'REQUEST_SUBMITTED',
  'REQUEST_VIEWED',
  'RELATION_ACCEPTED',
  'MESSAGE_AUTHORIZED',
  'REQUEST_REFUSED',
  'CHANNEL_AUTHORIZED',
  'CHANNEL_EXPIRED',
  'CHANNEL_REVOKED',
  'DOOR_ACTIVATED',
  'DOOR_SUSPENDED',
  'DOOR_REACTIVATED',
  'PAUSE_ACTIVATED',
  'PAUSE_ENDED'
);

CREATE TABLE "goodissima_entry_doors" (
  "id" TEXT NOT NULL,
  "state" "GoodissimaEntryDoorStatus" NOT NULL,
  "name" TEXT NOT NULL,
  "requestedChannels" "GoodissimaChannelType"[],
  "conditions" TEXT[],
  "lastActivity" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goodissima_entry_doors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goodissima_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "doorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "availability" TEXT NOT NULL,
  "requestedChannels" "GoodissimaChannelType"[],
  "conditions" TEXT[],
  "trustSignals" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goodissima_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goodissima_requests" (
  "id" TEXT NOT NULL,
  "state" "GoodissimaRequestStatus" NOT NULL,
  "requesterName" TEXT NOT NULL,
  "requesterRole" TEXT NOT NULL,
  "receiverName" TEXT NOT NULL,
  "motive" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "requestedChannels" "GoodissimaChannelType"[],
  "trustSignals" TEXT[],
  "receivedAt" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goodissima_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goodissima_relations" (
  "id" TEXT NOT NULL,
  "state" "GoodissimaRelationStatus" NOT NULL,
  "personName" TEXT NOT NULL,
  "receiverName" TEXT NOT NULL,
  "motive" TEXT NOT NULL,
  "protections" TEXT[],
  "createdFromRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goodissima_relations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goodissima_channels" (
  "id" TEXT NOT NULL,
  "relationId" TEXT NOT NULL,
  "kind" "GoodissimaChannelType" NOT NULL,
  "state" "GoodissimaChannelStatus" NOT NULL,
  "scope" TEXT NOT NULL,
  "expiration" TEXT NOT NULL,
  "personName" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goodissima_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goodissima_relational_pause" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "state" "GoodissimaPauseStatus" NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goodissima_relational_pause_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goodissima_history_events" (
  "id" TEXT NOT NULL,
  "type" "GoodissimaHistoryEventType" NOT NULL,
  "label" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "relationId" TEXT,
  "channelId" TEXT,
  "doorId" TEXT,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goodissima_history_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goodissima_relations_createdFromRequestId_key" ON "goodissima_relations"("createdFromRequestId");
CREATE INDEX "goodissima_entry_doors_state_idx" ON "goodissima_entry_doors"("state");
CREATE INDEX "goodissima_profiles_doorId_idx" ON "goodissima_profiles"("doorId");
CREATE INDEX "goodissima_profiles_userId_idx" ON "goodissima_profiles"("userId");
CREATE INDEX "goodissima_requests_state_idx" ON "goodissima_requests"("state");
CREATE INDEX "goodissima_requests_createdAt_idx" ON "goodissima_requests"("createdAt");
CREATE INDEX "goodissima_relations_state_idx" ON "goodissima_relations"("state");
CREATE INDEX "goodissima_channels_relationId_idx" ON "goodissima_channels"("relationId");
CREATE INDEX "goodissima_channels_state_idx" ON "goodissima_channels"("state");
CREATE INDEX "goodissima_channels_expiresAt_idx" ON "goodissima_channels"("expiresAt");
CREATE INDEX "goodissima_history_events_type_createdAt_idx" ON "goodissima_history_events"("type", "createdAt");
CREATE INDEX "goodissima_history_events_requestId_idx" ON "goodissima_history_events"("requestId");
CREATE INDEX "goodissima_history_events_relationId_idx" ON "goodissima_history_events"("relationId");
CREATE INDEX "goodissima_history_events_channelId_idx" ON "goodissima_history_events"("channelId");
CREATE INDEX "goodissima_history_events_doorId_idx" ON "goodissima_history_events"("doorId");

ALTER TABLE "goodissima_profiles"
  ADD CONSTRAINT "goodissima_profiles_doorId_fkey"
  FOREIGN KEY ("doorId") REFERENCES "goodissima_entry_doors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goodissima_relations"
  ADD CONSTRAINT "goodissima_relations_createdFromRequestId_fkey"
  FOREIGN KEY ("createdFromRequestId") REFERENCES "goodissima_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "goodissima_channels"
  ADD CONSTRAINT "goodissima_channels_relationId_fkey"
  FOREIGN KEY ("relationId") REFERENCES "goodissima_relations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goodissima_history_events"
  ADD CONSTRAINT "goodissima_history_events_relationId_fkey"
  FOREIGN KEY ("relationId") REFERENCES "goodissima_relations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "goodissima_history_events"
  ADD CONSTRAINT "goodissima_history_events_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "goodissima_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "goodissima_history_events"
  ADD CONSTRAINT "goodissima_history_events_doorId_fkey"
  FOREIGN KEY ("doorId") REFERENCES "goodissima_entry_doors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
