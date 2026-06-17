import assert from "node:assert/strict";
import test from "node:test";
import type { CiroRecord } from "../src/ciro/model.js";
import { evaluateMerge } from "../src/merge/candidate-evaluator.js";
import { scoreMerge } from "../src/merge/scoring-engine.js";

function ciro(input: { relationship?: string; roles?: string[]; trust?: string; family?: string } = {}): CiroRecord {
  return {
    schemaVersion: "1.0",
    c: { intent: input.family ?? "PROPERTY_RENTAL" },
    i: { trustPolicy: input.trust ?? "REAL_ESTATE_RENTAL_POLICY" },
    r: { roles: input.roles ?? ["locataire", "proprietaire"] },
    o: { relationship: input.relationship ?? "PROPERTY_RENTAL" },
    sources: [{ knowledgeId: "goodissima-trust-architecture" }],
  };
}

test("evaluateMerge ranks candidates by total score descending", () => {
  const source = ciro();
  const result = evaluateMerge(source, [
    ciro({ relationship: "EMPLOYMENT" }),
    ciro({ trust: "OTHER_POLICY" }),
    ciro(),
  ]);
  assert.deepEqual(result.map((candidate) => [candidate.candidateIndex, candidate.totalScore, candidate.status]), [
    [2, 4, "EXACT_MATCH"],
    [1, 3, "STRONG_MATCH"],
    [0, 0, "NO_MATCH"],
  ]);
});

test("evaluateMerge optionally filters no-match candidates", () => {
  const result = evaluateMerge(ciro(), [ciro({ relationship: "EMPLOYMENT" }), ciro()], { filterNoMatch: true });
  assert.equal(result.length, 1);
  assert.equal(result[0].candidateIndex, 1);
  assert.equal(result[0].status, "EXACT_MATCH");
});

test("evaluateMerge preserves input order when total scores are tied", () => {
  const first = ciro({ trust: "FIRST_POLICY" });
  const second = ciro({ roles: ["proprietaire", "locataire"] });
  const result = evaluateMerge(ciro(), [first, second]);
  assert.deepEqual(result.map((candidate) => candidate.candidateIndex), [0, 1]);
  assert.deepEqual(result.map((candidate) => candidate.totalScore), [3, 3]);
});

test("evaluateMerge preserves scoreMerge explanations per candidate", () => {
  const source = ciro();
  const candidate = ciro({ trust: "OTHER_POLICY" });
  const expected = scoreMerge(source, candidate);
  const [evaluated] = evaluateMerge(source, [candidate]);
  assert.deepEqual(evaluated.explanation, expected.explanation);
  assert.deepEqual(
    { relationshipScore: evaluated.relationshipScore, roleScore: evaluated.roleScore, trustScore: evaluated.trustScore, familyScore: evaluated.familyScore },
    { relationshipScore: expected.relationshipScore, roleScore: expected.roleScore, trustScore: expected.trustScore, familyScore: expected.familyScore },
  );
});
