import assert from "node:assert/strict";
import test from "node:test";
import { buildOpportunityRulesV1 } from "../lib/opportunities/opportunity-projection.ts";
import { businessObjectLabel, classifyGLink, classifyRelationTemplate } from "../lib/business-object-classification.ts";

test("classifie les Opportunities modernes NEED et OFFER et les liens simples", () => {
  for (const type of ["NEED", "OFFER"] as const) assert.equal(classifyGLink(buildOpportunityRulesV1({}, { type, criteria: { subject: "Service" } })), "MODERN_OPPORTUNITY");
  assert.equal(classifyGLink({ simpleLink: true, creationSource: "opportunity" }), "SIMPLE_LINK");
  assert.equal(classifyGLink({ creationSource: "opportunity", opportunity: { schemaVersion: 1 } }), "LEGACY_AMBIGUOUS");
});

test("distingue Journey, Opportunity historique et objet ambigu sans inférence textuelle", () => {
  assert.equal(classifyRelationTemplate({ metadata: { source: "governance-v1-minimal-create", creationPlan: { title: "Parcours" } } }), "JOURNEY");
  assert.equal(classifyRelationTemplate({ metadata: { opportunityPresentation: {} } }), "LEGACY_OPPORTUNITY");
  assert.equal(classifyRelationTemplate({ metadata: {} }), "LEGACY_AMBIGUOUS");
  assert.equal(classifyRelationTemplate({ metadata: { source: "governance-v1-minimal-create", opportunityPresentation: {} } }), "LEGACY_AMBIGUOUS");
  assert.equal(classifyRelationTemplate({ metadata: {}, relationTemplate: { description: "Je recherche un garage" } }), "LEGACY_AMBIGUOUS");
});

test("les libellés restent métier et ne révèlent pas la taxonomie interne", () => {
  assert.equal(businessObjectLabel("LEGACY_OPPORTUNITY"), "Opportunité");
  assert.equal(businessObjectLabel("JOURNEY"), "Parcours");
  assert.equal(businessObjectLabel("LEGACY_AMBIGUOUS"), "Objet historique à vérifier");
});
