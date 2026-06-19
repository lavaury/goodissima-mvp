import type { ResolveIntentStatus } from "../resolve/types.js";

export interface ResolutionStatusCounts {
  resolved: number;
  noMatch: number;
  multipleMatches: number;
  unmappedPaths: number;
  invalidCiro: number;
}

export interface ResolutionQualityReport {
  version: "0";
  passed: boolean;
  totalBenchmarkCases: number;
  benchmarkPassed: number;
  benchmarkFailed: number;
  passRatePercent: number;
  failRatePercent: number;
  resolution: ResolutionStatusCounts;
  governedPathCount: number;
  sourceCount: number;
  expressionCount: number;
  governance: {
    valid: boolean;
    issues: string[];
  };
  detectorBenchmark: {
    total: number;
    passed: number;
    failed: number;
  };
  ciroBenchmark: {
    total: number;
    passed: number;
    failed: number;
  };
  cases: Array<{
    benchmark: "detector" | "ciro";
    id: string;
    status: ResolveIntentStatus;
  }>;
}
