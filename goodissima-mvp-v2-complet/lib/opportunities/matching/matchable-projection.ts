import { asGLinkRules, isSimpleLinkRules, projectOpportunity, type OpportunityGLinkInput } from "../opportunity-projection.ts";
import type { OpportunityCriteriaV1, OpportunityType } from "../contracts.ts";

export const MATCHABLE_OPPORTUNITY_PROJECTION_VERSION = 1 as const;
export type ExplicitMatchingConsent = "ENABLED" | "DISABLED";
export type MatchableOpportunityProjectionV1 = {
  schemaVersion: typeof MATCHABLE_OPPORTUNITY_PROJECTION_VERSION;
  opportunityType: OpportunityType;
  subject: string;
  category?: string;
  locations?: string[];
  availability?: OpportunityCriteriaV1["availability"];
  dateWindow?: OpportunityCriteriaV1["dateWindow"];
  priceRange?: OpportunityCriteriaV1["priceRange"];
  terms?: string[];
};

export function structuredOpportunityMatchingConsent(rules: unknown): ExplicitMatchingConsent {
  const opportunity = asGLinkRules(rules).opportunity;
  return opportunity && typeof opportunity === "object" && !Array.isArray(opportunity)
    && (opportunity as Record<string, unknown>).matchingEnabled === true ? "ENABLED" : "DISABLED";
}
export function isStructuredOpportunityMatchingEnabled(rules: unknown): boolean {
  return structuredOpportunityMatchingConsent(rules) === "ENABLED";
}
export function buildMatchableOpportunityProjection(link: OpportunityGLinkInput): MatchableOpportunityProjectionV1 | null {
  if (isSimpleLinkRules(link.rules)) return null;
  const value = projectOpportunity(link);
  if (!value || value.legacy || value.structuredMetadataInvalid || value.hasGovernedJourney || !value.type || !value.structuredCriteria) return null;
  const criteria = value.structuredCriteria;
  return {
    schemaVersion: MATCHABLE_OPPORTUNITY_PROJECTION_VERSION, opportunityType: value.type, subject: criteria.subject,
    ...(criteria.category ? { category: criteria.category } : {}),
    ...(criteria.locations ? { locations: [...criteria.locations] } : {}),
    ...(criteria.availability ? { availability: { ...criteria.availability, ...(criteria.availability.days ? { days: [...criteria.availability.days] } : {}) } } : {}),
    ...(criteria.dateWindow ? { dateWindow: { ...criteria.dateWindow } } : {}),
    ...(criteria.priceRange ? { priceRange: { ...criteria.priceRange } } : {}),
    ...(criteria.terms ? { terms: [...criteria.terms] } : {}),
  };
}
