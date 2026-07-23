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
