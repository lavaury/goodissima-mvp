import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadCorpus } from "../src/corpus/loader.js";
import { runDetectorBenchmark } from "../src/benchmark/detector-runner.js";
import type { BenchmarkDataset } from "../src/benchmark/types.js";
import { createDeterministicIntentDetectorV0 } from "../src/detector/factory.js";
import {
  readExpressionManifest,
  readIntentTaxonomy,
  validateExpressionManifest,
  validateIntentTaxonomy,
} from "../src/detector/manifest.js";
import type { ExpressionManifest } from "../src/detector/types.js";
import { FileSystemKnowledgeAccessLayer } from "../src/knowledge/filesystem.js";
import { readFile } from "node:fs/promises";
import { readModeCatalog } from "../src/detector/mode-catalog.js";

async function fixture() {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(testDirectory, "../..");
  const knowledge = await FileSystemKnowledgeAccessLayer.fromManifest(
    path.join(packageRoot, "knowledge/manifests/goodissima.manifest.json"),
  );
  const corpus = await loadCorpus(knowledge);
  const taxonomyPath = path.join(packageRoot, "knowledge/detector/intent-taxonomy.v0.json");
  const manifestPath = path.join(packageRoot, "knowledge/detector/expression-manifest.v0.json");
  const modeCatalogPath = path.join(packageRoot, "knowledge/detector/mode-catalog.v0.json");
  const taxonomy = await readIntentTaxonomy(taxonomyPath);
  const manifest = await readExpressionManifest(manifestPath);
  const modeCatalog = await readModeCatalog(modeCatalogPath);
  return { corpus, knowledge, manifest, manifestPath, modeCatalog, modeCatalogPath, taxonomy, taxonomyPath };
}

function withEntry(
  manifest: ExpressionManifest,
  entry: ExpressionManifest["entries"][number],
): ExpressionManifest {
  return { version: "1.0", entries: [entry] };
}

test("rejects an invalid source", async () => {
  const { corpus, manifest, taxonomy } = await fixture();
  const result = validateExpressionManifest(
    withEntry(manifest, {
      expression: "AI_TEST_MODE=scenario",
      knowledgeId: "not-in-kal",
      mode: "AI_TEST_MODE=scenario",
    }),
    taxonomy,
    corpus,
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "invalid_source"));
});

test("rejects an unknown intent", async () => {
  const { corpus, manifest, taxonomy } = await fixture();
  const result = validateExpressionManifest(
    withEntry(manifest, {
      expression: "AI_TEST_MODE=scenario",
      knowledgeId: "goodissima-ai-governance",
      intent: "UNKNOWN_INTENT",
    }),
    taxonomy,
    corpus,
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "unknown_intent"));
});

test("rejects an invalid mode", async () => {
  const { corpus, manifest, taxonomy } = await fixture();
  const result = validateExpressionManifest(
    withEntry(manifest, {
      expression: "AI_TEST_MODE=scenario",
      knowledgeId: "goodissima-ai-governance",
      mode: "UNKNOWN_MODE",
    }),
    taxonomy,
    corpus,
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "invalid_mode"));
});

test("rejects a duplicate expression", async () => {
  const { corpus, taxonomy } = await fixture();
  const entry = {
    expression: "AI_TEST_MODE=scenario",
    knowledgeId: "goodissima-ai-governance",
    mode: "AI_TEST_MODE=scenario",
  } as const;
  const result = validateExpressionManifest(
    { version: "1.0", entries: [entry, entry] },
    taxonomy,
    corpus,
  );
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "duplicate_expression"));
});

test("validates taxonomy and detects populated source-grounded intents", async () => {
  const { corpus, knowledge, manifestPath, modeCatalog, modeCatalogPath, taxonomy, taxonomyPath } = await fixture();
  const taxonomyValidation = validateIntentTaxonomy(taxonomy, corpus, modeCatalog);
  assert.equal(taxonomyValidation.valid, true);
  assert.deepEqual(
    taxonomy.intents.map((entry) => entry.id),
    ["HOUSING", "PROPERTY_RENTAL", "EMPLOYMENT", "FREELANCE", "SERVICES"],
  );

  const detector = await createDeterministicIntentDetectorV0(
    knowledge,
    taxonomyPath,
    manifestPath,
    modeCatalogPath,
  );
  const result = detector.detect("agence immobiliere et verification de revenus");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].kind, "intent");
  assert.equal(result.candidates[0].label, "HOUSING");
  assert.equal(result.candidates[0].confidence, 0.95);
  assert.equal(result.candidates[0].evidence.length, 2);
  assert.equal("c" in result, false);
  assert.equal("role" in result, false);
  assert.equal("relationship" in result, false);
  assert.equal("trustPolicy" in result, false);
});

test("leaves intents without source expressions undetected", async () => {
  const { knowledge, manifestPath, modeCatalogPath, taxonomyPath } = await fixture();
  const detector = await createDeterministicIntentDetectorV0(
    knowledge,
    taxonomyPath,
    manifestPath,
    modeCatalogPath,
  );
  assert.deepEqual(detector.detect("freelance").candidates, []);
  assert.deepEqual(detector.detect("services").candidates, []);
});

test("detects the expanded source-grounded housing and employment expressions", async () => {
  const { knowledge, manifestPath, modeCatalogPath, taxonomyPath } = await fixture();
  const detector = await createDeterministicIntentDetectorV0(
    knowledge,
    taxonomyPath,
    manifestPath,
    modeCatalogPath,
  );

  const housing = detector.detect("verification de revenus");
  assert.equal(housing.candidates[0]?.label, "HOUSING");
  assert.equal(housing.candidates[0]?.evidence[0]?.knowledgeId, "goodissima-trust-architecture");

  const employment = detector.detect("candidat et recruteur");
  assert.equal(employment.candidates[0]?.label, "EMPLOYMENT");
  assert.equal(employment.candidates[0]?.evidence[0]?.knowledgeId, "goodissima-trust-architecture");
});

test("passes populated detector benchmark expectations", async () => {
  const { knowledge, manifestPath, modeCatalogPath, taxonomyPath } = await fixture();
  const detector = await createDeterministicIntentDetectorV0(
    knowledge,
    taxonomyPath,
    manifestPath,
    modeCatalogPath,
  );
  const benchmarkPath = path.resolve(
    path.dirname(taxonomyPath),
    "../benchmarks/detector.v0.json",
  );
  const dataset = JSON.parse(await readFile(benchmarkPath, "utf8")) as BenchmarkDataset;
  const report = await runDetectorBenchmark(dataset, detector);
  assert.equal(report.evaluated, 6);
  assert.equal(report.passed, 6);
  assert.equal(report.failed, 0);
});

test("rejects an expression absent from its declared source", async () => {
  const { corpus, manifest, taxonomy } = await fixture();
  const result = validateExpressionManifest(
    withEntry(manifest, {
      expression: "TRUST_ADMISSION_MODE=ENFORCE",
      knowledgeId: "goodissima-ai-governance",
      mode: "TRUST_ADMISSION_MODE=ENFORCE",
    }),
    taxonomy,
    corpus,
  );
  assert.equal(result.valid, false);
  assert.ok(
    !result.valid &&
      result.issues.some((issue) => issue.code === "expression_not_source_grounded"),
  );
});
