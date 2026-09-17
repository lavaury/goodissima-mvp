export const JOURNEY_PEOPLE_COMPACT_LIMIT = 5;

export function projectCompactJourneyPeople<Active, Pending>(
  active: readonly Active[],
  pending: readonly Pending[],
  limit = JOURNEY_PEOPLE_COMPACT_LIMIT,
) {
  const compactLimit = Math.max(0, Math.floor(limit));
  return {
    totalActive: active.length,
    totalPending: pending.length,
    totalPeople: active.length + pending.length,
    visibleActive: active.slice(0, compactLimit),
    remainingActive: active.slice(compactLimit),
    visiblePending: pending.slice(0, compactLimit),
    remainingPending: pending.slice(compactLimit),
    hasOverflow: active.length > compactLimit || pending.length > compactLimit,
  };
}
