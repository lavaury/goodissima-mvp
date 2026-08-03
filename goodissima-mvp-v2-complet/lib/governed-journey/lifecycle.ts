import type { GovernedJourneyEventType, GovernedJourneyStatus } from "@prisma/client";

export type GovernedJourneyCommand = "ACTIVATE" | "SUSPEND" | "RESUME" | "CLOSE" | "CANCEL";

export type GovernedJourneyTransition = {
  command: GovernedJourneyCommand;
  from: GovernedJourneyStatus;
  to: GovernedJourneyStatus;
  eventType: GovernedJourneyEventType;
  reasonRequired: boolean;
};

export const governedJourneyTransitions: readonly GovernedJourneyTransition[] = [
  { command: "ACTIVATE", from: "DRAFT", to: "ACTIVE", eventType: "ACTIVATED", reasonRequired: false },
  { command: "SUSPEND", from: "ACTIVE", to: "SUSPENDED", eventType: "SUSPENDED", reasonRequired: true },
  { command: "RESUME", from: "SUSPENDED", to: "ACTIVE", eventType: "RESUMED", reasonRequired: false },
  { command: "CLOSE", from: "ACTIVE", to: "CLOSED", eventType: "CLOSED", reasonRequired: false },
  { command: "CANCEL", from: "DRAFT", to: "CANCELLED", eventType: "CANCELLED", reasonRequired: true },
  { command: "CANCEL", from: "ACTIVE", to: "CANCELLED", eventType: "CANCELLED", reasonRequired: true },
  { command: "CANCEL", from: "SUSPENDED", to: "CANCELLED", eventType: "CANCELLED", reasonRequired: true },
] as const;

export const governedJourneyCommandTargets: Record<GovernedJourneyCommand, GovernedJourneyStatus> = {
  ACTIVATE: "ACTIVE",
  SUSPEND: "SUSPENDED",
  RESUME: "ACTIVE",
  CLOSE: "CLOSED",
  CANCEL: "CANCELLED",
};

export function findGovernedJourneyTransition(status: GovernedJourneyStatus, command: GovernedJourneyCommand) {
  return governedJourneyTransitions.find((transition) => transition.from === status && transition.command === command) ?? null;
}

export function isGovernedJourneyCommandIdempotent(status: GovernedJourneyStatus, command: GovernedJourneyCommand) {
  return governedJourneyCommandTargets[command] === status;
}

export function normalizeGovernedJourneyReason(reason: string | undefined, required: boolean) {
  const normalized = reason?.trim() || null;
  if (required && !normalized) return { ok: false as const, code: "REASON_REQUIRED" as const };
  if (normalized && normalized.length > 500) return { ok: false as const, code: "INVALID_INPUT" as const };
  return { ok: true as const, value: normalized };
}

export function governedJourneyLifecycleDates(
  command: GovernedJourneyCommand,
  current: { startedAt: Date | null },
  occurredAt: Date,
) {
  switch (command) {
    case "ACTIVATE":
      return { startedAt: current.startedAt ?? occurredAt, suspendedAt: null };
    case "SUSPEND":
      return { suspendedAt: occurredAt };
    case "RESUME":
      return { suspendedAt: null };
    case "CLOSE":
      return { closedAt: occurredAt, suspendedAt: null };
    case "CANCEL":
      return { cancelledAt: occurredAt, suspendedAt: null };
  }
}
