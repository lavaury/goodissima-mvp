import type { BenchmarkDataset } from "./types.js";
import type { CiroBuilderV0 } from "../ciro/builder.js";
import { benchmarkCaseText } from "./annotations.js";

export interface CiroBenchmarkReport {
  total: number;
  passed: number;
  failed: number;
  cases: Array<{ id: string; passed: boolean; issues: string[] }>;
}

export function runCiroBenchmark(
  dataset: BenchmarkDataset,
  builder: CiroBuilderV0,
): CiroBenchmarkReport {
  const cases = dataset.cases.map((benchmarkCase) => {
    const actual = builder.build(benchmarkCaseText(benchmarkCase));
    const issues: string[] = [];
    if (JSON.stringify(actual) !== JSON.stringify(benchmarkCase.expected)) {
      issues.push("Built CIRO does not match the expected record.");
    }
    return { id: benchmarkCase.id, passed: issues.length === 0, issues };
  });
  return {
    total: cases.length,
    passed: cases.filter((item) => item.passed).length,
    failed: cases.filter((item) => !item.passed).length,
    cases,
  };
}
