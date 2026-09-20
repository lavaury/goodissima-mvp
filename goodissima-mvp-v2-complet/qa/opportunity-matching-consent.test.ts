import assert from "node:assert/strict";
import test from "node:test";
import { buildOpportunityRulesV1 } from "../lib/opportunities/opportunity-projection.ts";
import { buildMatchableOpportunityProjection, isStructuredOpportunityMatchingEnabled, structuredOpportunityMatchingConsent } from "../lib/opportunities/matching/matchable-projection.ts";

const criteria = { subject: "Garde d’enfants", category: "Services", locations: ["Beauvais"], availability: { days: ["TUESDAY" as const], timeFrom: "18:00", timeTo: "20:00" }, dateWindow: { from: "2026-10-01", to: "2026-12-31" }, priceRange: { min: 15, max: 25, currency: "EUR", unit: "heure" }, terms: ["soir"] };
const enabledRules = buildOpportunityRulesV1({}, { type: "NEED", criteria, matchingEnabled: true });

test("matching consent is affirmative only and independent from publication", () => {
  assert.equal(structuredOpportunityMatchingConsent(enabledRules), "ENABLED");
  assert.equal(isStructuredOpportunityMatchingEnabled(enabledRules), true);
  assert.equal(isStructuredOpportunityMatchingEnabled(buildOpportunityRulesV1({}, { type: "NEED", criteria, matchingEnabled: false })), false);
  assert.equal(isStructuredOpportunityMatchingEnabled(buildOpportunityRulesV1({}, { type: "NEED", criteria })), false);
  assert.equal(isStructuredOpportunityMatchingEnabled({ creationSource: "opportunity", opportunity: { schemaVersion: 1, type: "NEED", criteria }, matchingEnabled: true }), false);
});

test("matchable projection is a deterministic whitelist and rejects non-structured objects", () => {
  const privateMarkers = { ownerId: "PRIVATE_OWNER", title: "PRIVATE_TITLE", description: "mail PRIVATE_EMAIL phone PRIVATE_PHONE", slug: "PRIVATE_SLUG", url: "PRIVATE_URL", documents: ["PRIVATE_DOCUMENT"] };
  const first = buildMatchableOpportunityProjection({ ...privateMarkers, rules: enabledRules });
  const second = buildMatchableOpportunityProjection({ ...privateMarkers, rules: enabledRules });
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first!).sort(), ["availability", "category", "dateWindow", "locations", "opportunityType", "priceRange", "schemaVersion", "subject", "terms"]);
  const serialized = JSON.stringify(first);
  for (const marker of Object.values(privateMarkers).flat().map(String)) assert.equal(serialized.includes(marker), false);
  assert.equal(buildMatchableOpportunityProjection({ rules: { simpleLink: true } }), null);
  assert.equal(buildMatchableOpportunityProjection({ rules: { creationSource: "opportunity" } }), null);
  assert.equal(buildMatchableOpportunityProjection({ rules: enabledRules, templateId: "governed" }), null);
});
