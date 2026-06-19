import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderResolutionQualityText } from "../src/quality/dashboard.js";
import { runResolutionQualityDashboard } from "../src/quality/runner.js";
import { FileSystemKnowledgeAccessLayer } from "../src/knowledge/filesystem.js";

async function report() {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(testDirectory, "../..");
  return runResolutionQualityDashboard({
    knowledge: await FileSystemKnowledgeAccessLayer.fromManifest(
      path.join(root, "knowledge/manifests/goodissima.manifest.json"),
    ),
    taxonomyPath: path.join(root, "knowledge/detector/intent-taxonomy.v0.json"),
    expressionManifestPath: path.join(root, "knowledge/detector/expression-manifest.v0.json"),
    modeCatalogPath: path.join(root, "knowledge/detector/mode-catalog.v0.json"),
    ciroPathManifestPath: path.join(root, "knowledge/ciro/paths.v0.json"),
    detectorBenchmarkPath: path.join(root, "knowledge/benchmarks/detector.v0.json"),
    ciroBenchmarkPath: path.join(root, "knowledge/benchmarks/ciro.v0.json"),
  });
}

test("quality dashboard consolidates benchmarks, resolution, and governance", async () => {
  const result = await report();

  assert.equal(result.passed, true);
  assert.equal(result.totalBenchmarkCases, 14);
  assert.equal(result.benchmarkPassed, 14);
  assert.equal(result.benchmarkFailed, 0);
  assert.equal(result.passRatePercent, 100);
  assert.equal(result.failRatePercent, 0);
  assert.deepEqual(result.resolution, {
    resolved: 11,
    noMatch: 1,
    multipleMatches: 1,
    unmappedPaths: 1,
    invalidCiro: 0,
  });
  assert.equal(result.governedPathCount, 6);
  assert.equal(result.sourceCount, 6);
  assert.equal(result.expressionCount, 12);
  assert.equal(result.governance.valid, true);
});

test("quality dashboard renders readable text", async () => {
  const text = renderResolutionQualityText(await report());

  assert.match(text, /Overall: PASS/u);
  assert.match(text, /Benchmark cases: 14/u);
  assert.match(text, /Resolved: 11/u);
  assert.match(text, /No match: 1/u);
  assert.match(text, /Multiple matches: 1/u);
  assert.match(text, /Unmapped paths: 1/u);
  assert.match(text, /Invalid CIRO: 0/u);
  assert.match(text, /Governed paths: 6/u);
  assert.match(text, /Knowledge sources: 6/u);
  assert.match(text, /Expressions: 12/u);
});
