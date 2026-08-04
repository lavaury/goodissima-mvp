import type { GovernedJourneyEventType, GovernedJourneyStatus } from "@prisma/client";

export type GovernedJourneySummary = {
  id: string;
  title: string;
  status: GovernedJourneyStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  suspendedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  visibleMemorySourceCount: number | null;
};

export type GovernedJourneyEvent = {
  type: GovernedJourneyEventType;
  fromStatus: GovernedJourneyStatus | null;
  toStatus: GovernedJourneyStatus;
  sequence: number;
  occurredAt: string;
};

export type GovernedJourneyDetail = GovernedJourneySummary & {
  events: GovernedJourneyEvent[];
};

export type GovernedJourneyList = {
  items: GovernedJourneySummary[];
  nextCursor: string | null;
};
