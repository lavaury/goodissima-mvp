import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildOpportunityRulesV1, projectOpportunity } from "../lib/opportunities/opportunity-projection.ts";
import { compareDate, compareDays, compareLocation, comparePrice, compareTime } from "../lib/opportunities/matching/comparators.ts";
import { isStructuredOpportunityAdmissible, matchStructuredOpportunity, opportunityMatchBand, rankStructuredOpportunityMatches } from "../lib/opportunities/matching/structured-matcher.ts";
import type { OpportunityCriteriaV1, OpportunityType } from "../lib/opportunities/contracts.ts";

function input(id: string, type: OpportunityType, criteria: OpportunityCriteriaV1, extra: Record<string, unknown> = {}) {
  return { id, ownerId: "owner-1", status: "ACTIVE", matchingConsent: "EXPLICIT", projection: { schemaVersion: 1, opportunityType: type, ...criteria }, ...extra } as any;
}
const need = input("need", "NEED", { subject: "baby-sitter", locations: ["Beauvais"], availability: { days: ["TUESDAY", "THURSDAY"], timeFrom: "18:00", timeTo: "20:00" } });
const strong = input("offer", "OFFER", { subject: "garde d’enfants", locations: ["beauvais"], availability: { days: ["TUESDAY", "THURSDAY"], timeFrom: "17:00", timeTo: "21:00" } });

test("A: complementary childcare opportunities produce a very good structured match", () => {
  const result = matchStructuredOpportunity(need, strong)!;
  assert.equal(result.band, "VERY_GOOD");
  for (const criterion of ["location", "days", "time", "subject"]) assert.equal(result.explanation.comparisons.find((item) => item.criterion === criterion)?.outcome, "COMPATIBLE");
  assert.ok(result.explanation.semanticSignals.length > 0);
});
test("B and L: a hard day/time incompatibility cannot be rescued by semantic similarity", () => {
  const incompatible = input("lille", "OFFER", { subject: "garde d’enfants", locations: ["Lille"], availability: { days: ["MONDAY"], timeFrom: "08:00", timeTo: "12:00" } });
  assert.equal(compareDays(need.projection.availability, incompatible.projection.availability).outcome, "INCOMPATIBLE");
  assert.equal(matchStructuredOpportunity(need, incompatible), null);
});
test("C to H: admissibility rejects same type, non-opportunities and every inactive status", () => {
  assert.equal(matchStructuredOpportunity(need, input("same", "NEED", need.projection)), null);
  assert.equal(matchStructuredOpportunity(input("offer-source", "OFFER", strong.projection), strong), null);
  for (const value of [
    { ...need, projection: null },
    { ...need, matchingConsent: "DISABLED" },
    ...["DRAFT", "DISABLED", "EXPIRED", "ARCHIVED"].map((status) => ({ ...need, status })),
  ]) assert.equal(isStructuredOpportunityAdmissible(value as any), false);
  assert.equal(matchStructuredOpportunity(need, { ...strong, ownerId: "owner-2" }), null);
});
test("I and J: absent values and different currencies remain UNKNOWN", () => {
  assert.equal(compareLocation(undefined, ["Beauvais"]).outcome, "UNKNOWN");
  assert.equal(compareTime({ days: ["TUESDAY"] }, { days: ["TUESDAY"], timeFrom: "10:00", timeTo: "11:00" }).outcome, "UNKNOWN");
  assert.equal(compareDate({ from: "2026-09-01" }, { to: "2026-09-30" }).outcome, "UNKNOWN");
  assert.equal(comparePrice({ min: 10, max: 20, currency: "EUR", unit: "hour" }, { min: 10, max: 20, currency: "USD", unit: "hour" }).outcome, "UNKNOWN");
});
test("K: subject synonyms create a positive semantic signal", () => assert.ok(matchStructuredOpportunity(need, strong)?.explanation.semanticSignals.length));
test("qualitative band thresholds are closed and deterministic", () => {
  assert.equal(opportunityMatchBand(49), "POSSIBLE");
  assert.equal(opportunityMatchBand(50), "GOOD");
  assert.equal(opportunityMatchBand(79), "GOOD");
  assert.equal(opportunityMatchBand(80), "VERY_GOOD");
});
test("three compatible candidates remain three independently persistable results", () => {
  const results = rankStructuredOpportunityMatches(need, [strong, { ...strong, id: "offer-2" }, { ...strong, id: "offer-3" }]);
  assert.deepEqual(results.map((item) => item.targetGLinkId).sort(), ["offer", "offer-2", "offer-3"]);
});
test("projection gates simple, legacy and invalid metadata while accepting V1", () => {
  assert.equal(projectOpportunity({ rules: { simpleLink: true } }), null);
  assert.equal(projectOpportunity({ rules: { creationSource: "opportunity" } })?.legacy, true);
  assert.equal(projectOpportunity({ rules: { creationSource: "opportunity", opportunity: { schemaVersion: 1, type: "BAD", criteria: {} } } })?.structuredMetadataInvalid, true);
  assert.equal(projectOpportunity({ rules: buildOpportunityRulesV1({}, { type: "NEED", criteria: { subject: "Service" } }) })?.legacy, false);
});
test("same-owner store and snapshots exclude historical and private data", () => {
  const store = readFileSync(new URL("../lib/matching/glink-matching-source-store.ts", import.meta.url), "utf8");
  const execution = readFileSync(new URL("../lib/matching/matching-execution-service.ts", import.meta.url), "utf8");
  assert.match(store, /where: \{ ownerId, status: "ACTIVE", id: \{ not: excludedGLinkId \}/);
  const structured = store.slice(store.indexOf("listStructuredCandidatesForOwner"));
  assert.doesNotMatch(structured, /formTemplates|fields: fieldSelection|RelationCase|messages|documents|email|phone/i);
  assert.match(execution, /scope: "OWNER_ONLY"/);
  const snapshot = execution.slice(execution.indexOf("const criteriaSnapshot"), execution.indexOf("const prepared"));
  assert.doesNotMatch(snapshot, /email|phone|messages|documents|RelationCase/i);
});
