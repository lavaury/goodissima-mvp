import assert from "node:assert/strict";
import test from "node:test";
import { runBenchmark } from "../src/benchmark/runner.js";
import { benchmarkCaseText } from "../src/benchmark/annotations.js";

test("skips benchmark cases when no detector subject is configured", async () => {
  const report = await runBenchmark({
    version: "1.0",
    cases: [{ id: "case-1", input: { text: "opaque input" } }],
  });

  assert.equal(report.subject, null);
  assert.equal(report.skipped, 1);
  assert.equal(report.passed, 0);
  assert.equal(report.failed, 0);
});

test("materializes only explicit benchmark source annotations", () => {
  const benchmarkCase = {
    id: "annotated",
    input: { text: "immobilier" },
    sourceAnnotations: [{
      expression: "rechercher",
      knowledgeId: "goodissima-user-manual",
      kind: "mode" as const,
      label: "SEARCH",
    }],
  };
  assert.equal(benchmarkCaseText(benchmarkCase), "immobilier rechercher");
});
