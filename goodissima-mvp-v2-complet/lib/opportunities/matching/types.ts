import type { MatchableOpportunityProjectionV1 } from "./matchable-projection.ts";

export const OPPORTUNITY_MATCH_OUTCOMES = ["COMPATIBLE", "INCOMPATIBLE", "UNKNOWN"] as const;
export type OpportunityMatchOutcome = (typeof OPPORTUNITY_MATCH_OUTCOMES)[number];
export const OPPORTUNITY_MATCH_BANDS = ["VERY_GOOD", "GOOD", "POSSIBLE"] as const;
export type OpportunityMatchBand = (typeof OPPORTUNITY_MATCH_BANDS)[number];

export type StructuredOpportunityMatchInput = {
  id: string;
  ownerId: string;
  status: string;
  matchingConsent: "EXPLICIT" | "DISABLED";
  projection: MatchableOpportunityProjectionV1 | null;
};

export type OpportunityCriterion = "subject" | "category" | "location" | "days" | "time" | "date" | "price" | "terms";
export type OpportunityComparison = { criterion: OpportunityCriterion; outcome: OpportunityMatchOutcome; label: string };
export type OpportunityStructuredExplanation = {
  engine: "opportunity-structured-v1";
  band: OpportunityMatchBand;
  comparisons: OpportunityComparison[];
  semanticSignals: string[];
};
export type StructuredOpportunityMatch = {
  targetGLinkId: string;
  internalScore: number;
  band: OpportunityMatchBand;
  explanation: OpportunityStructuredExplanation;
};
