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

type GLinkMatchingEvent = { action: string; outputSummary: string | null; createdAt: Date };

export type GLinkMatchingDisplayState =
  | { status: "DISABLED"; count: 0 }
  | { status: "TO_ANALYZE"; count: 0 }
  | { status: "MATCHES_TO_REVIEW"; count: number }
  | { status: "FOLLOW_UP_TO_DECIDE"; count: number }
  | { status: "NO_RESULTS"; count: 0 };

function parseJson(value: string | null) {
  if (!value?.startsWith("{")) return null;
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return null; }
}

export function deriveGLinkMatchingDisplayState({
  rules,
  sourceId,
  events,
}: {
  rules: unknown;
  sourceId: string;
  events: GLinkMatchingEvent[];
}): GLinkMatchingDisplayState {
  if (!parseGLinkMatchingState(rules).enabled) return { status: "DISABLED", count: 0 };
  const latestEnable = events.find((event) => event.action === "glink_matching_enabled" && parseJson(event.outputSummary)?.sourceId === sourceId);
  const analysisEvent = events.find((event) => {
    const payload = parseJson(event.outputSummary);
    return event.action === "glink_matching_analysis" && payload?.sourceId === sourceId &&
      (!latestEnable || event.createdAt >= latestEnable.createdAt);
  });
  if (!analysisEvent) return { status: "TO_ANALYZE", count: 0 };
  const analysis = parseJson(analysisEvent.outputSummary);
  const matches = Array.isArray(analysis?.matches)
    ? analysis.matches.flatMap((match) => match && typeof match === "object" && typeof (match as Record<string, unknown>).relationId === "string" ? [(match as Record<string, unknown>).relationId as string] : [])
    : [];
  const latestByTarget = new Map<string, string>();
  for (const event of events) {
    if (!["glink_matching_interested", "glink_matching_ignored"].includes(event.action)) continue;
    const payload = parseJson(event.outputSummary);
    const targetId = typeof payload?.targetId === "string" ? payload.targetId : "";
    if (payload?.sourceId !== sourceId || !targetId || latestByTarget.has(targetId)) continue;
    latestByTarget.set(targetId, event.action);
  }
  const interestingCount = matches.filter((id) => latestByTarget.get(id) === "glink_matching_interested").length;
  if (interestingCount > 0) return { status: "FOLLOW_UP_TO_DECIDE", count: interestingCount };
  const reviewCount = matches.filter((id) => !latestByTarget.has(id)).length;
  if (reviewCount > 0) return { status: "MATCHES_TO_REVIEW", count: reviewCount };
  return { status: "NO_RESULTS", count: 0 };
}
