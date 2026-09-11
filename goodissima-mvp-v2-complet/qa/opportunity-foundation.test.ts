import assert from "node:assert/strict";
import test from "node:test";
import { parseOpportunityRulesV1, safeParseOpportunityRulesV1, type OpportunityRulesV1 } from "../lib/opportunities/contracts.ts";
import { buildOpportunityRulesV1, projectOpportunity } from "../lib/opportunities/opportunity-projection.ts";
import { linkObjectLabel } from "../lib/object-creation.ts";

const need: OpportunityRulesV1 = { schemaVersion: 1, type: "NEED", criteria: { subject: "baby-sitter", locations: ["Beauvais"], availability: { days: ["TUESDAY", "THURSDAY"], timeFrom: "18:00" } } };

test("accepts bounded OFFER and NEED contracts", () => {
  assert.equal(parseOpportunityRulesV1(need).type, "NEED");
  assert.equal(parseOpportunityRulesV1({ schemaVersion: 1, type: "OFFER", criteria: { subject: "Accompagnement", category: "Services", dateWindow: { from: "2027-01-01", to: "2027-02-01" }, priceRange: { min: 20, max: 30, currency: "EUR", unit: "hour" }, terms: ["soir"] } }).type, "OFFER");
});

test("rejects invalid enums, unknown properties, bounds and versions", () => {
  for (const value of [{ ...need, type: "UNKNOWN" }, { ...need, extra: true }, { ...need, criteria: { subject: "x", extra: true } }, { ...need, criteria: { subject: "x".repeat(161) } }, { ...need, criteria: { subject: "x", terms: Array(21).fill("term") } }, { ...need, schemaVersion: 2 }]) {
    assert.equal(safeParseOpportunityRulesV1(value).success, false);
  }
});

test("projects structured, legacy, historical-template and invalid opportunities fail-safe", () => {
  assert.deepEqual(projectOpportunity({ rules: { creationSource: "opportunity", opportunity: need } }), { legacy: false, structuredMetadataInvalid: false, type: "NEED", structuredCriteria: need.criteria, hasGovernedJourney: false, governedJourneyId: null });
  assert.deepEqual(projectOpportunity({ rules: { creationSource: "opportunity" } }), { legacy: true, structuredMetadataInvalid: false, type: null, structuredCriteria: null, hasGovernedJourney: false, governedJourneyId: null });
  assert.deepEqual(projectOpportunity({ rules: { creationSource: "opportunity" }, templateId: "journey-1" }), { legacy: true, structuredMetadataInvalid: false, type: null, structuredCriteria: null, hasGovernedJourney: true, governedJourneyId: "journey-1" });
  assert.deepEqual(projectOpportunity({ rules: { creationSource: "opportunity", opportunity: { ...need, schemaVersion: 2 } } }), { legacy: true, structuredMetadataInvalid: true, type: null, structuredCriteria: null, hasGovernedJourney: false, governedJourneyId: null });
});

test("does not project ordinary or simple links, including ambiguous historical rules", () => {
  assert.equal(projectOpportunity({ rules: {} }), null);
  assert.equal(projectOpportunity({ rules: { simpleLink: true } }), null);
  assert.equal(projectOpportunity({ rules: { simpleLink: true, creationSource: "opportunity", opportunity: need } }), null);
  assert.equal(linkObjectLabel({ simpleLink: true, creationSource: "opportunity" }), "Lien simple");
});

test("never infers OFFER or NEED from historical titles or descriptions", () => {
  assert.equal(projectOpportunity({ rules: { creationSource: "opportunity" }, title: "je recherche" } as never)?.type, null);
  assert.equal(projectOpportunity({ rules: { creationSource: "opportunity" }, description: "je propose" } as never)?.type, null);
});

test("builder validates, preserves unrelated rules and does not mutate input", () => {
  const base = Object.freeze({ requireEmail: true, nested: Object.freeze({ retained: true }) });
  const built = buildOpportunityRulesV1(base, { type: need.type, criteria: need.criteria });
  assert.deepEqual(built, { requireEmail: true, nested: { retained: true }, creationSource: "opportunity", opportunity: need });
  assert.equal("simpleLink" in built, false);
  assert.deepEqual(base, { requireEmail: true, nested: { retained: true } });
  assert.throws(() => buildOpportunityRulesV1(base, { type: "UNKNOWN" as never, criteria: need.criteria }));
  assert.throws(() => buildOpportunityRulesV1({ simpleLink: true }, { type: need.type, criteria: need.criteria }));
});
