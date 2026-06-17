import type { DeterministicIntentDetectorV0 } from "../detector/detector.js";
import type { IntentDetectionResult } from "../detector/types.js";
import type { BenchmarkDataset } from "./types.js";
import { benchmarkCaseText } from "./annotations.js";

export interface DetectorBenchmarkCaseResult {
  id: string;
  result: IntentDetectionResult;
  expectationMet: boolean | null;
  issues: string[];
}

export interface DetectorBenchmarkReport {
  detectorVersion: "0";
  total: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  evaluated: number;
  passed: number;
  failed: number;
  cases: DetectorBenchmarkCaseResult[];
}

function evaluateExpectation(
  benchmarkCase: BenchmarkDataset["cases"][number],
  result: IntentDetectionResult,
): { expectationMet: boolean | null; issues: string[] } {
  if (!benchmarkCase.expectedDetection) {
    return { expectationMet: null, issues: [] };
  }
  const actual = result.candidates.map(({ kind, label }) => ({ kind, label }));
  const expected = benchmarkCase.expectedDetection.candidates;
  const issues: string[] = [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    issues.push("Detected candidates do not match expected candidates.");
  }
  if (result.ambiguous !== benchmarkCase.expectedDetection.ambiguous) {
    issues.push("Ambiguity does not match the expected value.");
  }
  return { expectationMet: issues.length === 0, issues };
}

export async function runDetectorBenchmark(
  dataset: BenchmarkDataset,
  detector: DeterministicIntentDetectorV0,
): Promise<DetectorBenchmarkReport> {
  if (dataset.version !== "1.0" || !Array.isArray(dataset.cases)) {
    throw new Error("Unsupported or invalid benchmark dataset.");
  }
  const cases = dataset.cases.map((benchmarkCase) => {
    const result = detector.detect(benchmarkCaseText(benchmarkCase));
    return {
      id: benchmarkCase.id,
      result,
      ...evaluateExpectation(benchmarkCase, result),
    };
  });
  const evaluatedCases = cases.filter((item) => item.expectationMet !== null);
  return {
    detectorVersion: "0",
    total: cases.length,
    matched: cases.filter((item) => item.result.candidates.length > 0).length,
    unmatched: cases.filter((item) => item.result.candidates.length === 0).length,
    ambiguous: cases.filter((item) => item.result.ambiguous).length,
    evaluated: evaluatedCases.length,
    passed: evaluatedCases.filter((item) => item.expectationMet === true).length,
    failed: evaluatedCases.filter((item) => item.expectationMet === false).length,
    cases,
  };
}
