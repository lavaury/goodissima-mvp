export const MATCHING_RUN_STATUSES = [
  "PREPARED",
  "RUNNING",
  "RESULTS_AVAILABLE",
  "FAILED",
  "CLOSED",
] as const;

export type MatchingRunStatus = (typeof MATCHING_RUN_STATUSES)[number];

export const MATCHING_RESULT_STATUSES = [
  "AVAILABLE",
  "SELECTED",
  "DISMISSED",
  "LINKED",
] as const;

export type MatchingResultStatus = (typeof MATCHING_RESULT_STATUSES)[number];

export type MatchingRunControlState = {
  status: MatchingRunStatus;
  isPaused: boolean;
};

export type MatchingRunRecord = MatchingRunControlState & {
  id: string;
  gLinkId: string;
  ownerId: string;
  engineVersion: string;
  criteriaSnapshot: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  pausedAt: Date | null;
  closedAt: Date | null;
  failureCode: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MatchingResultRecord = {
  id: string;
  runId: string;
  targetGLinkId: string;
  status: MatchingResultStatus;
  explanation: unknown;
  internalRank: number | null;
  selectedAt: Date | null;
  dismissedAt: Date | null;
  linkedAt: Date | null;
  relationCaseId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const MATCHING_DOMAIN_ERROR_CODES = [
  "MATCHING_RUN_NOT_FOUND",
  "MATCHING_RESULT_NOT_FOUND",
  "MATCHING_FORBIDDEN",
  "MATCHING_RUN_CLOSED",
  "MATCHING_RUN_PAUSED",
  "MATCHING_INVALID_RUN_TRANSITION",
  "MATCHING_INVALID_RESULT_TRANSITION",
  "MATCHING_IDEMPOTENCY_CONFLICT",
  "MATCHING_SOURCE_NOT_FOUND",
  "MATCHING_TARGET_NOT_FOUND",
  "MATCHING_OWNER_MISMATCH",
  "MATCHING_SELF_TARGET",
  "MATCHING_DUPLICATE_RESULT",
] as const;

export type MatchingDomainErrorCode = (typeof MATCHING_DOMAIN_ERROR_CODES)[number];

export class MatchingDomainError extends Error {
  readonly code: MatchingDomainErrorCode;

  constructor(code: MatchingDomainErrorCode) {
    super(code);
    this.name = "MatchingDomainError";
    this.code = code;
  }
}

const RUN_TRANSITIONS: Readonly<Record<MatchingRunStatus, readonly MatchingRunStatus[]>> = {
  PREPARED: ["RUNNING", "CLOSED"],
  RUNNING: ["RESULTS_AVAILABLE", "FAILED"],
  RESULTS_AVAILABLE: ["CLOSED"],
  FAILED: ["PREPARED", "CLOSED"],
  CLOSED: [],
};

const RESULT_TRANSITIONS: Readonly<Record<MatchingResultStatus, readonly MatchingResultStatus[]>> = {
  AVAILABLE: ["SELECTED", "DISMISSED"],
  SELECTED: ["AVAILABLE", "DISMISSED", "LINKED"],
  DISMISSED: ["AVAILABLE"],
  LINKED: ["SELECTED"],
};

export function canTransitionMatchingRun(
  current: MatchingRunControlState,
  nextStatus: MatchingRunStatus,
): boolean {
  if (current.isPaused || current.status === "CLOSED") return false;
  return RUN_TRANSITIONS[current.status].includes(nextStatus);
}

export function canPauseMatchingRun(current: MatchingRunControlState): boolean {
  return current.status !== "CLOSED" && !current.isPaused;
}

export function canResumeMatchingRun(current: MatchingRunControlState): boolean {
  return current.status !== "CLOSED" && current.isPaused;
}

export function setMatchingRunPaused(
  current: MatchingRunControlState,
  isPaused: boolean,
): MatchingRunControlState | null {
  if (isPaused ? !canPauseMatchingRun(current) : !canResumeMatchingRun(current)) return null;
  return { status: current.status, isPaused };
}

export function canTransitionMatchingResult(
  run: MatchingRunControlState,
  currentStatus: MatchingResultStatus,
  nextStatus: MatchingResultStatus,
): boolean {
  if (run.status === "CLOSED" || run.isPaused) return false;
  return RESULT_TRANSITIONS[currentStatus].includes(nextStatus);
}
