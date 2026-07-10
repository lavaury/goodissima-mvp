-- Discovery Context Enrollment V1.
-- Extends mock-compatible enum values for context enrollment actions.

ALTER TYPE "GoodissimaDiscoveryContextStatus" ADD VALUE IF NOT EXISTS 'Inactive';

ALTER TYPE "GoodissimaHistoryEventType" ADD VALUE IF NOT EXISTS 'DISCOVERY_CONTEXT_ACTIVATED';
ALTER TYPE "GoodissimaHistoryEventType" ADD VALUE IF NOT EXISTS 'DISCOVERY_CONTEXT_SUSPENDED';
ALTER TYPE "GoodissimaHistoryEventType" ADD VALUE IF NOT EXISTS 'DISCOVERY_CONTEXT_HIDDEN';
ALTER TYPE "GoodissimaHistoryEventType" ADD VALUE IF NOT EXISTS 'DISCOVERY_CONTEXT_CHANNELS_UPDATED';
ALTER TYPE "GoodissimaHistoryEventType" ADD VALUE IF NOT EXISTS 'DISCOVERY_CONTEXT_CONDITIONS_UPDATED';
