import { safeParseOpportunityRulesV1 } from "./opportunities/contracts.ts";
import { asGLinkRules } from "./opportunities/opportunity-projection.ts";

export type BusinessObjectClassification =
  | "MODERN_OPPORTUNITY"
  | "LEGACY_OPPORTUNITY"
  | "SIMPLE_LINK"
  | "JOURNEY"
  | "LEGACY_AMBIGUOUS";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function classifyGLink(rulesValue: unknown): BusinessObjectClassification {
  const rules = asGLinkRules(rulesValue);
  if (rules.simpleLink === true) return "SIMPLE_LINK";
  if (rules.creationSource === "opportunity" && safeParseOpportunityRulesV1(rules.opportunity).success) return "MODERN_OPPORTUNITY";
  return "LEGACY_AMBIGUOUS";
}

export function classifyRelationTemplate(snapshotValue: unknown): BusinessObjectClassification {
  const snapshot = record(snapshotValue);
  const metadata = record(snapshot.metadata);
  const creationPlan = record(metadata.creationPlan);
  const opportunity = Object.prototype.hasOwnProperty.call(metadata, "opportunityPresentation");
  const governance = metadata.source === "governance-v1-minimal-create"
    || Object.keys(creationPlan).length > 0;
  if (opportunity && governance) return "LEGACY_AMBIGUOUS";
  if (governance) return "JOURNEY";
  if (opportunity) return "LEGACY_OPPORTUNITY";
  return "LEGACY_AMBIGUOUS";
}

export function businessObjectLabel(classification: BusinessObjectClassification) {
  if (classification === "MODERN_OPPORTUNITY" || classification === "LEGACY_OPPORTUNITY") return "Opportunité";
  if (classification === "SIMPLE_LINK") return "Lien";
  if (classification === "JOURNEY") return "Parcours";
  return "Objet historique à vérifier";
}
