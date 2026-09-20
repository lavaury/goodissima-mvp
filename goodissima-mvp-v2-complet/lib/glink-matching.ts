export type GLinkMatchingState = {
  enabled: boolean;
  status: "DISABLED" | "TO_ANALYZE";
};

export function parseGLinkMatchingState(rules: unknown): GLinkMatchingState {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return { enabled: false, status: "DISABLED" };
  const value = rules as Record<string, unknown>;
  const enabled = value.matchingEnabled === true;
  return {
    enabled,
    status: enabled && value.matchingStatus === "TO_ANALYZE" ? "TO_ANALYZE" : enabled ? "TO_ANALYZE" : "DISABLED",
  };
}

export function mergeGLinkRules(rules: unknown, patch: Record<string, unknown>) {
  const current = rules && typeof rules === "object" && !Array.isArray(rules) ? rules as Record<string, unknown> : {};
  return { ...current, ...patch };
}

export function wasGLinkMatchingEnabledAtCreation(rules: unknown) {
  return Boolean(rules && typeof rules === "object" && !Array.isArray(rules) && (rules as Record<string, unknown>).matchingEnabledAtCreation === true);
}

import type { MatchingResultStatus, MatchingRunStatus } from "./matching-contracts.ts";

export type GLinkMatchingDisplayState =
  | { status: "DISABLED"; count: 0 }
  | { status: "TO_ANALYZE"; count: 0 }
  | { status: "MATCHES_TO_REVIEW"; count: number }
  | { status: "FOLLOW_UP_TO_DECIDE"; count: number }
  | { status: "NO_RESULTS"; count: 0 };

export type GLinkMatchingSummary = {
  hasRun: boolean;
  runStatus: MatchingRunStatus | null;
  lastRunAt: Date | null;
  totalResults: number;
  availableCount: number;
  selectedCount: number;
  dismissedCount: number;
  linkedCount: number;
  hasResultsToReview: boolean;
  hasHumanFollowUp: boolean;
  hasNoResults: boolean;
};

type MatchingSummaryRun = {
  status: MatchingRunStatus;
  createdAt: Date;
  completedAt: Date | null;
  results: Array<{ status: MatchingResultStatus }>;
};

export function deriveGLinkMatchingSummary(run: MatchingSummaryRun | null): GLinkMatchingSummary {
  const counts = { AVAILABLE: 0, SELECTED: 0, DISMISSED: 0, LINKED: 0 } satisfies Record<MatchingResultStatus, number>;
  for (const result of run?.results ?? []) counts[result.status] += 1;
  const isFinalResults = run?.status === "RESULTS_AVAILABLE" || run?.status === "CLOSED";
  return {
    hasRun: Boolean(run),
    runStatus: run?.status ?? null,
    lastRunAt: run ? run.completedAt ?? run.createdAt : null,
    totalResults: run?.results.length ?? 0,
    availableCount: counts.AVAILABLE,
    selectedCount: counts.SELECTED,
    dismissedCount: counts.DISMISSED,
    linkedCount: counts.LINKED,
    hasResultsToReview: Boolean(isFinalResults && counts.AVAILABLE > 0),
    hasHumanFollowUp: Boolean(isFinalResults && counts.SELECTED > 0),
    hasNoResults: Boolean(isFinalResults && run?.results.length === 0),
  };
}

export function deriveGLinkMatchingDisplayState({
  rules,
  summary,
}: {
  rules: unknown;
  summary: GLinkMatchingSummary | undefined;
}): GLinkMatchingDisplayState {
  if (!parseGLinkMatchingState(rules).enabled) return { status: "DISABLED", count: 0 };
  if (!summary?.hasRun || summary.runStatus !== "RESULTS_AVAILABLE" && summary.runStatus !== "CLOSED") return { status: "TO_ANALYZE", count: 0 };
  if (summary.hasHumanFollowUp) return { status: "FOLLOW_UP_TO_DECIDE", count: summary.selectedCount };
  if (summary.hasResultsToReview) return { status: "MATCHES_TO_REVIEW", count: summary.availableCount };
  return { status: "NO_RESULTS", count: 0 };
}
