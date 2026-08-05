import type { GovernedJourneyEventType, GovernedJourneyStatus } from "@prisma/client";

/** Internal ledger state only. `ledgerStatus` is not the operational journey's business status. */
export type InternalGovernedJourneyLedgerView = {
  id: string;
  relationTemplateId: string;
  relationCaseId: string | null;
  ledgerStatus: GovernedJourneyStatus;
  createdAt: string;
  updatedAt: string;
};

export type InternalGovernedJourneyResolution = {
  formTemplateId: string;
  relationTemplateId: string;
  title: string;
  ledger: InternalGovernedJourneyLedgerView | null;
};

/** @deprecated GJ-4 presenter compatibility only; no active route consumes this type. */
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

/** @deprecated GJ-4 presenter compatibility only; no active route consumes this type. */
export type GovernedJourneyDetail = GovernedJourneySummary & {
  events: GovernedJourneyEvent[];
};

/** @deprecated The R1-B read model exposes no list. */
export type GovernedJourneyList = {
  items: GovernedJourneySummary[];
  nextCursor: string | null;
};
