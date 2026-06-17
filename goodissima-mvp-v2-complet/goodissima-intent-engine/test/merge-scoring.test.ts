import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { CiroRecord } from "../src/ciro/model.js";
import { runMergeBenchmark } from "../src/merge/benchmark-runner.js";
import { loadCompatibilityMatrix, loadMergeBenchmark, loadScoringRules } from "../src/merge/loader.js";
import { scoreMerge } from "../src/merge/scoring-engine.js";

function ciro(input: { relationship: string; roles: string[]; trust: string; family: string }): CiroRecord {
  return {
    schemaVersion: "1.0",
    c: { intent: input.family },
    i: { trustPolicy: input.trust },
    r: { roles: input.roles },
    o: { relationship: input.relationship },
    sources: [{ knowledgeId: "goodissima-trust-architecture" }],
  };
}

const exact = ciro({ relationship: "PROPERTY_RENTAL", roles: ["locataire", "proprietaire"], trust: "REAL_ESTATE_RENTAL_POLICY", family: "PROPERTY_RENTAL" });

test("scoreMerge returns an exact match for identical explicit CIRO dimensions", () => {
  const result = scoreMerge(exact, structuredClone(exact));
  assert.deepEqual({ relationship: result.relationshipScore, role: result.roleScore, trust: result.trustScore, family: result.familyScore, total: result.totalScore, status: result.status }, { relationship: 1, role: 1, trust: 1, family: 1, total: 4, status: "EXACT_MATCH" });
  assert.equal(result.explanation.length, 4);
});

test("scoreMerge assigns no role score to incompatible explicit roles", () => {
  const other = ciro({ relationship: "PROPERTY_RENTAL", roles: ["candidat", "recruteur"], trust: "REAL_ESTATE_RENTAL_POLICY", family: "PROPERTY_RENTAL" });
  const result = scoreMerge(exact, other);
  assert.equal(result.roleScore, 0);
  assert.equal(result.totalScore, 3);
  assert.equal(result.status, "STRONG_MATCH");
});

test("scoreMerge assigns no trust score to an explicit trust mismatch", () => {
  const other = ciro({ relationship: "PROPERTY_RENTAL", roles: ["locataire", "proprietaire"], trust: "OTHER_POLICY", family: "PROPERTY_RENTAL" });
  const result = scoreMerge(exact, other);
  assert.equal(result.trustScore, 0);
  assert.equal(result.totalScore, 3);
  assert.equal(result.status, "STRONG_MATCH");
});

test("scoreMerge assigns no family score to an explicit family mismatch", () => {
  const other = ciro({ relationship: "PROPERTY_RENTAL", roles: ["locataire", "proprietaire"], trust: "REAL_ESTATE_RENTAL_POLICY", family: "HOUSING" });
  const result = scoreMerge(exact, other);
  assert.equal(result.familyScore, 0);
  assert.equal(result.totalScore, 3);
  assert.equal(result.status, "STRONG_MATCH");
});

test("scoreMerge fails closed for an unknown matrix entry", () => {
  const other = ciro({ relationship: "EMPLOYMENT", roles: ["locataire", "proprietaire"], trust: "REAL_ESTATE_RENTAL_POLICY", family: "PROPERTY_RENTAL" });
  const result = scoreMerge(exact, other);
  assert.equal(result.totalScore, 0);
  assert.equal(result.status, "NO_MATCH");
  assert.deepEqual([result.relationshipScore, result.roleScore, result.trustScore, result.familyScore], [0, 0, 0, 0]);
});

test("merge benchmark runner evaluates governed CIRO pairs", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const report = runMergeBenchmark(
    await loadMergeBenchmark(path.join(root, "knowledge/benchmarks/merge-benchmark.v1.json")),
    await loadCompatibilityMatrix(path.join(root, "knowledge/merge/compatibility-matrix.v0.json")),
    await loadScoringRules(path.join(root, "knowledge/merge/scoring-rules.v1.json")),
  );
  assert.deepEqual({ total: report.total, passed: report.passed, failed: report.failed }, { total: 3, passed: 3, failed: 0 });
});
