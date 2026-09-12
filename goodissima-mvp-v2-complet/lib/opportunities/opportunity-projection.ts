import { parseOpportunityRulesV1, safeParseOpportunityRulesV1, type OpportunityCriteriaV1, type OpportunityRulesV1, type OpportunityType } from "./contracts.ts";

export type OpportunityGLinkInput = { rules: unknown; templateId?: string | null };

export type OpportunityProjection = {
  legacy: boolean;
  structuredMetadataInvalid: boolean;
  type: OpportunityType | null;
  structuredCriteria: OpportunityCriteriaV1 | null;
  hasGovernedJourney: boolean;
  governedJourneyId: string | null;
};

export function asGLinkRules(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function isSimpleLinkRules(value: unknown): boolean {
  return asGLinkRules(value).simpleLink === true;
}

export function isOpportunityRules(value: unknown): boolean {
  return !isSimpleLinkRules(value) && asGLinkRules(value).creationSource === "opportunity";
}

export function projectOpportunity(link: OpportunityGLinkInput): OpportunityProjection | null {
  if (!isOpportunityRules(link.rules)) return null;
  const rules = asGLinkRules(link.rules);
  const governedJourneyId = typeof link.templateId === "string" && link.templateId ? link.templateId : null;
  const parsed = safeParseOpportunityRulesV1(rules.opportunity);
  if (parsed.success) return {
    legacy: false, structuredMetadataInvalid: false, type: parsed.data.type, structuredCriteria: parsed.data.criteria,
    hasGovernedJourney: governedJourneyId !== null, governedJourneyId,
  };
  return {
    legacy: true, structuredMetadataInvalid: rules.opportunity !== undefined, type: null, structuredCriteria: null,
    hasGovernedJourney: governedJourneyId !== null, governedJourneyId,
  };
}

export function opportunityOwnerHref(link: OpportunityGLinkInput & { id: string }): string {
  const projection = projectOpportunity(link);
  return projection && !projection.legacy && !projection.hasGovernedJourney
    ? `/opportunities/${encodeURIComponent(link.id)}`
    : `/links/${encodeURIComponent(link.id)}`;
}

export function buildOpportunityRulesV1(baseRules: unknown, intent: Omit<OpportunityRulesV1, "schemaVersion">): Record<string, unknown> {
  const base = asGLinkRules(baseRules);
  if (base.simpleLink === true) throw new Error("A simple link cannot be reclassified as an opportunity.");
  const opportunity = parseOpportunityRulesV1({ schemaVersion: 1, ...intent });
  return { ...base, creationSource: "opportunity", opportunity };
}
