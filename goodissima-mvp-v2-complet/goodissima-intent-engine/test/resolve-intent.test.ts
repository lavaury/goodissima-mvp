import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createResolveIntentV0 } from "../src/resolve/factory.js";
import { FileSystemKnowledgeAccessLayer } from "../src/knowledge/filesystem.js";

async function fixture(benchmarkName = "ciro.v0.json") {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(testDirectory, "../..");
  const knowledge = await FileSystemKnowledgeAccessLayer.fromManifest(
    path.join(root, "knowledge/manifests/goodissima.manifest.json"),
  );
  return createResolveIntentV0(
    knowledge,
    path.join(root, "knowledge/detector/intent-taxonomy.v0.json"),
    path.join(root, "knowledge/detector/expression-manifest.v0.json"),
    path.join(root, "knowledge/ciro/paths.v0.json"),
    path.join(root, "knowledge/detector/mode-catalog.v0.json"),
    path.join(root, `knowledge/benchmarks/${benchmarkName}`),
  );
}

test("resolveIntent returns a governed CIRO on success", async () => {
  const resolveIntent = await fixture();
  const result = resolveIntent("rechercher recrutement");

  assert.equal(result.status, "RESOLVED");
  assert.deepEqual(result.ciro?.c, { intent: "EMPLOYMENT", mode: "SEARCH" });
  assert.equal(result.issues.length, 0);
  assert.equal("trace" in result, false);
});

test("resolveIntent trace explains a RESOLVED result", async () => {
  const resolveIntent = await fixture();
  const result = resolveIntent("rechercher recrutement", { trace: true });

  assert.equal(result.status, "RESOLVED");
  assert.deepEqual(result.trace?.selectedCiroPath, {
    intent: "EMPLOYMENT",
    mode: "SEARCH",
  });
  assert.equal(result.trace?.governance.valid, true);
  assert.equal(result.trace?.governance.governedPaths, 6);
  assert.equal(result.trace?.validation.performed, true);
  assert.equal(result.trace?.validation.valid, true);
  assert.deepEqual(result.trace?.candidateRanking.map(({ rank }) => rank), [1, 2]);
  assert.ok(
    result.trace?.matchedExpressions.some(
      (evidence) =>
        evidence.expression === "recrutement" &&
        evidence.knowledgeId === "goodissima-matching-governance",
    ),
  );
});

test("resolveIntent returns NO_MATCH when the detector has no candidates", async () => {
  const resolveIntent = await fixture();
  const result = resolveIntent("expression absente du corpus");

  assert.equal(result.status, "NO_MATCH");
  assert.equal(result.ciro, null);
  assert.deepEqual(result.candidates, []);
});

test("resolveIntent trace explains NO_MATCH without inventing evidence", async () => {
  const resolveIntent = await fixture();
  const result = resolveIntent("expression absente du corpus", { trace: true });

  assert.equal(result.status, "NO_MATCH");
  assert.deepEqual(result.trace?.matchedExpressions, []);
  assert.deepEqual(result.trace?.candidateRanking, []);
  assert.equal(result.trace?.selectedCiroPath, null);
  assert.equal(result.trace?.validation.performed, false);
  assert.equal(result.trace?.validation.valid, null);
});

test("resolveIntent returns MULTIPLE_MATCHES for ambiguous candidates", async () => {
  const resolveIntent = await fixture();
  const result = resolveIntent("rechercher immobilier recrutement");

  assert.equal(result.status, "MULTIPLE_MATCHES");
  assert.equal(result.ciro, null);
  assert.equal(result.candidates.filter((candidate) => candidate.kind === "intent").length, 2);
});

test("resolveIntent trace explains MULTIPLE_MATCHES ranking", async () => {
  const resolveIntent = await fixture();
  const result = resolveIntent("rechercher immobilier recrutement", { trace: true });

  assert.equal(result.status, "MULTIPLE_MATCHES");
  assert.equal(result.trace?.candidateRanking.length, 3);
  assert.deepEqual(
    result.trace?.candidateRanking.map(({ rank, label }) => ({ rank, label })),
    [
      { rank: 1, label: "EMPLOYMENT" },
      { rank: 2, label: "HOUSING" },
      { rank: 3, label: "SEARCH" },
    ],
  );
  assert.equal(result.trace?.selectedCiroPath, null);
  assert.equal(result.trace?.validation.performed, false);
});

test("resolveIntent returns UNMAPPED_PATH for an incomplete explicit candidate set", async () => {
  const resolveIntent = await fixture();
  const result = resolveIntent("dossier locataire");

  assert.equal(result.status, "UNMAPPED_PATH");
  assert.equal(result.ciro, null);
  assert.equal(result.candidates.length, 1);
});

test("resolveIntent trace explains an UNMAPPED_PATH", async () => {
  const resolveIntent = await fixture();
  const result = resolveIntent("dossier locataire", { trace: true });

  assert.equal(result.status, "UNMAPPED_PATH");
  assert.equal(result.trace?.selectedCiroPath, null);
  assert.equal(result.trace?.governance.valid, true);
  assert.equal(result.trace?.validation.performed, false);
  assert.ok(
    result.trace?.matchedExpressions.some(
      (evidence) => evidence.expression === "dossier locataire",
    ),
  );
});

test("resolver startup fails when governed benchmark coverage is invalid", async () => {
  await assert.rejects(
    fixture("detector.v0.json"),
    /CIRO governance failed: CIRO path .* has no benchmark expectation/u,
  );
});
