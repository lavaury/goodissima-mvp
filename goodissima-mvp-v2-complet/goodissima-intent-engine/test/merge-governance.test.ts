import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadCorpus } from "../src/corpus/loader.js";
import { readCiroPathManifest, validateCiroPathManifest } from "../src/ciro/path-manifest.js";
import { readIntentTaxonomy } from "../src/detector/manifest.js";
import { readModeCatalog } from "../src/detector/mode-catalog.js";
import { FileSystemKnowledgeAccessLayer } from "../src/knowledge/filesystem.js";
import { validateMergeBenchmark } from "../src/merge/benchmark-validator.js";
import { validateMergeGovernance } from "../src/merge/governance.js";
import {
  loadCompatibilityMatrix,
  loadMergeBenchmark,
  loadScoringRules,
} from "../src/merge/loader.js";
import { validateCompatibilityMatrix } from "../src/merge/matrix-validator.js";
import { validateScoringRules } from "../src/merge/scoring-validator.js";

async function fixture() {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(testDirectory, "../..");
  const knowledge = await FileSystemKnowledgeAccessLayer.fromManifest(
    path.join(root, "knowledge/manifests/goodissima.manifest.json"),
  );
  const corpus = await loadCorpus(knowledge);
  const paths = validateCiroPathManifest(
    await readCiroPathManifest(path.join(root, "knowledge/ciro/paths.v0.json")),
    await readIntentTaxonomy(path.join(root, "knowledge/detector/intent-taxonomy.v0.json")),
    corpus,
    await readModeCatalog(path.join(root, "knowledge/detector/mode-catalog.v0.json")),
  );
  const matrix = await loadCompatibilityMatrix(
    path.join(root, "knowledge/merge/compatibility-matrix.v0.json"),
  );
  const scoringRules = await loadScoringRules(
    path.join(root, "knowledge/merge/scoring-rules.v1.json"),
  );
  const benchmark = await loadMergeBenchmark(
    path.join(root, "knowledge/benchmarks/merge-benchmark.v1.json"),
  );
  return { benchmark, corpus, matrix, paths, scoringRules };
}

test("loads versioned merge knowledge assets", async () => {
  const { benchmark, matrix, scoringRules } = await fixture();
  assert.equal(matrix.version, "1.0");
  assert.equal(matrix.entries.length, 3);
  assert.equal(scoringRules.implementation, "DETERMINISTIC_V0");
  assert.equal(benchmark.cases.length, 3);
});

test("Merge Matrix Validator rejects unknown relationships", async () => {
  const { corpus, matrix } = await fixture();
  const invalid = structuredClone(matrix);
  invalid.entries[0].leftRelationship = "UNKNOWN_RELATIONSHIP";
  const result = validateCompatibilityMatrix(
    invalid,
    corpus,
    new Set(["PROPERTY_RENTAL", "HOUSING", "EMPLOYMENT"]),
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "unknown_relationship"));
});

test("Merge Matrix Validator rejects missing source grounding", async () => {
  const { corpus, matrix } = await fixture();
  const invalid = structuredClone(matrix);
  invalid.entries[0].source.expression = "expression absente";
  const result = validateCompatibilityMatrix(
    invalid,
    corpus,
    new Set(["PROPERTY_RENTAL", "HOUSING", "EMPLOYMENT"]),
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "source_not_grounded"));
});

test("Scoring Rules Validator rejects an invalid score total", async () => {
  const { corpus, scoringRules } = await fixture();
  const invalid = structuredClone(scoringRules);
  invalid.dimensions.role.score = 2;
  const result = validateScoringRules(invalid, corpus);
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "invalid_score_total"));
});

test("merge benchmark validation requires coverage for every matrix entry", async () => {
  const { benchmark, matrix } = await fixture();
  const invalid = structuredClone(benchmark);
  invalid.cases = invalid.cases.slice(0, 2);
  const result = validateMergeBenchmark(invalid, matrix);
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "matrix_entry_without_benchmark"));
});

test("merge governance validates deterministic scoring without implementing matching", async () => {
  const input = await fixture();
  const result = validateMergeGovernance({
    matrix: input.matrix,
    scoringRules: input.scoringRules,
    benchmark: input.benchmark,
    corpus: input.corpus,
    ciroPaths: input.paths,
  });
  assert.equal(result.valid, true);
  assert.equal(result.valid && result.matrixEntries, 3);
  assert.equal(result.valid && result.scoringRules, 6);
  assert.equal(result.valid && result.benchmarkCases, 3);
  assert.equal(result.valid && result.scoringImplemented, true);
  assert.equal(result.valid && result.matchingImplemented, false);
});
