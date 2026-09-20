import type { MatchingResultRecord } from "@/lib/matching-contracts";

export const MATCHING_RESULT_VIEW_CRITERIA = [
  "SUBJECT", "CATEGORY", "LOCATION", "DAYS", "TIME", "DATE_WINDOW", "PRICE", "TERMS",
] as const;

export type MatchingResultViewCriterion = (typeof MATCHING_RESULT_VIEW_CRITERIA)[number];
export type MatchingResultViewOutcome = "COMPATIBLE" | "UNKNOWN";
export type MatchingResultViewStatus = "AVAILABLE" | "SELECTED" | "DISMISSED";
export type MatchingResultViewLabel = "OFFER_MATCH" | "NEED_MATCH";
export type MatchingResultViewBand = "VERY_GOOD" | "GOOD" | "POSSIBLE";

export type MatchingResultExplanationViewV1 = {
  band: MatchingResultViewBand;
  comparisons: Array<{
    criterion: MatchingResultViewCriterion;
    outcome: MatchingResultViewOutcome;
  }>;
  semanticSummary: "RELATED" | "NO_SAFE_SEMANTIC_DETAIL";
};

export type MatchingResultViewV1 = {
  id: string;
  status: MatchingResultViewStatus;
  label: MatchingResultViewLabel;
  ordinal: number;
  band: MatchingResultViewBand;
  comparisons: MatchingResultExplanationViewV1["comparisons"];
  semanticSummary: MatchingResultExplanationViewV1["semanticSummary"];
  selectedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
};

type InternalExplanation = {
  band?: unknown;
  comparisons?: unknown;
  semanticSignals?: unknown;
};

const criterionCodes: Record<string, MatchingResultViewCriterion> = {
  subject: "SUBJECT",
  category: "CATEGORY",
  location: "LOCATION",
  days: "DAYS",
  time: "TIME",
  date: "DATE_WINDOW",
  price: "PRICE",
  terms: "TERMS",
};

export function projectRevealableExplanation(explanation: unknown): MatchingResultExplanationViewV1 {
  const internal = isRecord(explanation) ? explanation as InternalExplanation : {};
  const band = internal.band === "VERY_GOOD" || internal.band === "GOOD" || internal.band === "POSSIBLE"
    ? internal.band
    : "POSSIBLE";
  const comparisons = Array.isArray(internal.comparisons)
    ? internal.comparisons.flatMap((comparison) => {
        if (!isRecord(comparison) || typeof comparison.criterion !== "string") return [];
        const criterion = criterionCodes[comparison.criterion];
        if (!criterion) return [];
        return [{
          criterion,
          outcome: comparison.outcome === "COMPATIBLE" ? "COMPATIBLE" as const : "UNKNOWN" as const,
        }];
      })
    : [];
  return {
    band,
    comparisons,
    semanticSummary: Array.isArray(internal.semanticSignals) && internal.semanticSignals.length > 0
      ? "RELATED"
      : "NO_SAFE_SEMANTIC_DETAIL",
  };
}

export function projectMatchingResultView(input: {
  result: MatchingResultRecord;
  sourceType: "OFFER" | "NEED";
  ordinal: number;
}): MatchingResultViewV1 {
  const revealable = projectRevealableExplanation(input.result.explanation);
  return {
    id: input.result.id,
    status: input.result.status === "LINKED" ? "SELECTED" : input.result.status,
    label: input.sourceType === "NEED" ? "OFFER_MATCH" : "NEED_MATCH",
    ordinal: input.ordinal,
    band: revealable.band,
    comparisons: revealable.comparisons,
    semanticSummary: revealable.semanticSummary,
    selectedAt: input.result.selectedAt?.toISOString() ?? null,
    dismissedAt: input.result.dismissedAt?.toISOString() ?? null,
    createdAt: input.result.createdAt.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
