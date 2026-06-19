import { scoreMergeWithRules } from "./scoring-engine.js";
import type { CompatibilityMatrix, MergeBenchmark, ScoringRules } from "./types.js";

export interface MergeBenchmarkReport {
  total: number;
  passed: number;
  failed: number;
  cases: Array<{ id: string; passed: boolean; issues: string[] }>;
}

export function runMergeBenchmark(benchmark: MergeBenchmark, matrix: CompatibilityMatrix, rules: ScoringRules): MergeBenchmarkReport {
  const cases = benchmark.cases.map((benchmarkCase) => {
    const { explanation: _explanation, ...actual } = scoreMergeWithRules(benchmarkCase.ciroA, benchmarkCase.ciroB, matrix, rules);
    const issues = JSON.stringify(actual) === JSON.stringify(benchmarkCase.expected) ? [] : ["Merge score does not match the expected result."];
    return { id: benchmarkCase.id, passed: issues.length === 0, issues };
  });
  return { total: cases.length, passed: cases.filter((item) => item.passed).length, failed: cases.filter((item) => !item.passed).length, cases };
}
