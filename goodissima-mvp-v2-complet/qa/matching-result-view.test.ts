import test from "node:test";
import assert from "node:assert/strict";
import type { MatchingResultRecord } from "../lib/matching-contracts.ts";
import { projectMatchingResultView, projectRevealableExplanation } from "../lib/matching/matching-result-view.ts";

const sentinels = ["PRIVATE_OWNER_ID_X", "PRIVATE_TARGET_ID_X", "PRIVATE_SLUG_X", "PRIVATE_EMAIL_X", "PRIVATE_PHONE_X", "PRIVATE_LOCATION_X", "PRIVATE_TERM_X", "PRIVATE_DESCRIPTION_X"];

function internalResult(overrides: Partial<MatchingResultRecord> = {}): MatchingResultRecord {
  return {
    id: "result-public-handle", runId: "run-private", targetGLinkId: "PRIVATE_TARGET_ID_X", status: "AVAILABLE",
    explanation: {
      band: "VERY_GOOD",
      comparisons: [
        { criterion: "location", outcome: "COMPATIBLE", label: "PRIVATE_LOCATION_X" },
        { criterion: "terms", outcome: "INCOMPATIBLE", label: "PRIVATE_TERM_X" },
        { criterion: "unknown-private-key", outcome: "COMPATIBLE", label: "PRIVATE_DESCRIPTION_X" },
      ],
      semanticSignals: ["PRIVATE_DESCRIPTION_X similarity 0.987"], ownerId: "PRIVATE_OWNER_ID_X",
      slug: "PRIVATE_SLUG_X", email: "PRIVATE_EMAIL_X", phone: "PRIVATE_PHONE_X", score: 99,
    },
    internalRank: 42, selectedAt: null, dismissedAt: null, linkedAt: null, relationCaseId: null,
    createdAt: new Date("2026-09-12T10:00:00.000Z"), updatedAt: new Date("2026-09-12T10:00:00.000Z"), ...overrides,
  };
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) collectKeys(item, keys);
  else if (value && typeof value === "object") for (const [key, nested] of Object.entries(value)) { keys.add(key.toLowerCase()); collectKeys(nested, keys); }
  return keys;
}

test("structured result view has the exact closed contract", () => {
  const view = projectMatchingResultView({ result: internalResult(), sourceType: "NEED", ordinal: 1 });
  assert.deepEqual(Object.keys(view), ["id", "status", "label", "ordinal", "band", "comparisons", "semanticSummary", "selectedAt", "dismissedAt", "createdAt"]);
  assert.deepEqual(Object.keys(view.comparisons[0]!), ["criterion", "outcome"]);
  assert.equal(view.id, "result-public-handle"); assert.equal(view.label, "OFFER_MATCH"); assert.equal(view.ordinal, 1);
  assert.deepEqual(view.comparisons, [{ criterion: "LOCATION", outcome: "COMPATIBLE" }, { criterion: "TERMS", outcome: "UNKNOWN" }]);
});

test("recursive contract excludes internal and identifying keys", () => {
  const keys = collectKeys(projectMatchingResultView({ result: internalResult(), sourceType: "OFFER", ordinal: 3 }));
  for (const forbidden of ["targetGLinkId", "ownerId", "slug", "url", "publicUrl", "title", "description", "email", "phone", "telephone", "internalRank", "score", "similarity", "embedding"]) assert.equal(keys.has(forbidden.toLowerCase()), false, forbidden);
});

test("no sensitive sentinel crosses the structured serializer", () => {
  const json = JSON.stringify(projectMatchingResultView({ result: internalResult(), sourceType: "NEED", ordinal: 2 }));
  for (const sentinel of sentinels) assert.equal(json.includes(sentinel), false, sentinel);
  assert.doesNotMatch(json, /0\.987|99/);
});

test("revealable explanation emits codes only", () => {
  assert.deepEqual(projectRevealableExplanation(internalResult().explanation), {
    band: "VERY_GOOD", comparisons: [{ criterion: "LOCATION", outcome: "COMPATIBLE" }, { criterion: "TERMS", outcome: "UNKNOWN" }], semanticSummary: "RELATED",
  });
});

test("label depends only on source type and ordinal is caller supplied", () => {
  const result = internalResult();
  assert.equal(projectMatchingResultView({ result, sourceType: "NEED", ordinal: 7 }).label, "OFFER_MATCH");
  assert.equal(projectMatchingResultView({ result, sourceType: "OFFER", ordinal: 2 }).label, "NEED_MATCH");
  assert.equal(projectMatchingResultView({ result, sourceType: "NEED", ordinal: 7 }).ordinal, 7);
});

test("LINKED is not exposed by the structured V1 status contract", () => {
  assert.equal(projectMatchingResultView({ result: internalResult({ status: "LINKED" }), sourceType: "NEED", ordinal: 1 }).status, "SELECTED");
});
