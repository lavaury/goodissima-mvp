export type JourneyHistoryItem = {
  key: string;
  occurredAt: string;
  text: string;
  detail?: string | null;
  source: "journey" | "invitation" | "document" | "review" | "meeting" | "memory";
};

export const JOURNEY_HISTORY_INITIAL_COUNT = 12;

export function orderJourneyHistory(items: JourneyHistoryItem[]) {
  return [...items].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.key.localeCompare(left.key));
}
