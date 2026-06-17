import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generateBenchmark } from "../src/benchmark/generator.js";
import { createCorpusCoverageReport } from "../src/corpus/coverage.js";
import { loadCorpus } from "../src/corpus/loader.js";
import { calculateCorpusStatistics } from "../src/corpus/statistics.js";
import { validateCorpus } from "../src/corpus/validator.js";
import { FileSystemKnowledgeAccessLayer } from "../src/knowledge/filesystem.js";

async function fixture() {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.resolve(
    testDirectory,
    "../../knowledge/manifests/goodissima.manifest.json",
  );
  const knowledge = await FileSystemKnowledgeAccessLayer.fromManifest(manifestPath);
  const documents = await knowledge.list();
  const corpus = await loadCorpus(knowledge);
  return { corpus, documents };
}

test("loads a deterministic structural corpus from all KAL sources", async () => {
  const first = await fixture();
  const second = await fixture();

  assert.deepEqual(first.corpus, second.corpus);
  assert.equal(first.corpus.sources.length, first.documents.length);
  assert.ok(first.corpus.units.length >= first.documents.length);
  assert.equal(validateCorpus(first.corpus, { documents: first.documents }).valid, true);
});

test("validator rejects corpus content that differs from its source", async () => {
  const { corpus, documents } = await fixture();
  const tampered = structuredClone(corpus);
  tampered.units[0].content = `${tampered.units[0].content}\ninvented`;

  const result = validateCorpus(tampered, { documents });
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((item) => item.code === "source_mismatch"));
});

test("statistics and coverage account for the complete loaded corpus", async () => {
  const { corpus, documents } = await fixture();
  const statistics = calculateCorpusStatistics(corpus);
  const coverage = createCorpusCoverageReport(corpus, documents);

  assert.equal(statistics.sources, documents.length);
  assert.equal(statistics.units, corpus.units.length);
  assert.ok(statistics.words > 0);
  assert.equal(coverage.complete, true);
  assert.equal(coverage.sourceCoveragePercent, 100);
  assert.equal(coverage.lineCoveragePercent, 100);
});

test("benchmark generator emits source-grounded inputs without expected semantics", async () => {
  const { corpus } = await fixture();
  const benchmark = generateBenchmark(corpus, { limit: 3 });

  assert.equal(benchmark.cases.length, 3);
  for (const benchmarkCase of benchmark.cases) {
    assert.equal("expected" in benchmarkCase, false);
    assert.equal(typeof benchmarkCase.input, "object");
  }
});
