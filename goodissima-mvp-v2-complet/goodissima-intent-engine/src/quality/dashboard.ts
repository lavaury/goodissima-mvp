import type { BenchmarkDataset } from "../benchmark/types.js";
import type { DetectorBenchmarkReport } from "../benchmark/detector-runner.js";
import type { CiroBenchmarkReport } from "../benchmark/ciro-runner.js";
import type { CiroGovernanceResult } from "../ciro/governance.js";
import type { ExpressionManifest } from "../detector/types.js";
import type { KnowledgeDocument } from "../knowledge/types.js";
import type { ResolveIntentV0 } from "../resolve/factory.js";
import type { ResolutionQualityReport, ResolutionStatusCounts } from "./types.js";
import { benchmarkCaseText } from "../benchmark/annotations.js";

function percent(value: number, total: number): number {
  return total === 0 ? 100 : Number(((value / total) * 100).toFixed(2));
}

function textInput(dataset: BenchmarkDataset, id: string): string {
  const benchmarkCase = dataset.cases.find((item) => item.id === id);
  if (!benchmarkCase) throw new Error(`Benchmark case ${id} was not found.`);
  return benchmarkCaseText(benchmarkCase);
}

export function createResolutionQualityReport(input: {
  detectorDataset: BenchmarkDataset;
  detectorReport: DetectorBenchmarkReport;
  ciroDataset: BenchmarkDataset;
  ciroReport: CiroBenchmarkReport;
  governance: CiroGovernanceResult;
  resolve: ResolveIntentV0;
  documents: readonly KnowledgeDocument[];
  expressionManifest: ExpressionManifest;
}): ResolutionQualityReport {
  const cases = [
    ...input.detectorReport.cases.map((item) => ({
      benchmark: "detector" as const,
      id: item.id,
      status: input.resolve(textInput(input.detectorDataset, item.id)).status,
    })),
    ...input.ciroReport.cases.map((item) => ({
      benchmark: "ciro" as const,
      id: item.id,
      status: input.resolve(textInput(input.ciroDataset, item.id)).status,
    })),
  ];
  const count = (status: typeof cases[number]["status"]): number =>
    cases.filter((item) => item.status === status).length;
  const resolution: ResolutionStatusCounts = {
    resolved: count("RESOLVED"),
    noMatch: count("NO_MATCH"),
    multipleMatches: count("MULTIPLE_MATCHES"),
    unmappedPaths: count("UNMAPPED_PATH"),
    invalidCiro: count("INVALID_CIRO"),
  };
  const totalBenchmarkCases = input.detectorReport.total + input.ciroReport.total;
  const benchmarkPassed = input.detectorReport.passed + input.ciroReport.passed;
  const benchmarkFailed = input.detectorReport.failed + input.ciroReport.failed;
  const governanceIssues = input.governance.valid
    ? []
    : input.governance.issues.map((issue) => `${issue.code}: ${issue.message}`);

  return {
    version: "0",
    passed: input.governance.valid && benchmarkFailed === 0 && resolution.invalidCiro === 0,
    totalBenchmarkCases,
    benchmarkPassed,
    benchmarkFailed,
    passRatePercent: percent(benchmarkPassed, totalBenchmarkCases),
    failRatePercent: percent(benchmarkFailed, totalBenchmarkCases),
    resolution,
    governedPathCount: input.governance.valid ? input.governance.paths.length : 0,
    sourceCount: input.documents.length,
    expressionCount: input.expressionManifest.entries.length,
    governance: { valid: input.governance.valid, issues: governanceIssues },
    detectorBenchmark: {
      total: input.detectorReport.total,
      passed: input.detectorReport.passed,
      failed: input.detectorReport.failed,
    },
    ciroBenchmark: {
      total: input.ciroReport.total,
      passed: input.ciroReport.passed,
      failed: input.ciroReport.failed,
    },
    cases,
  };
}

export function renderResolutionQualityText(report: ResolutionQualityReport): string {
  return [
    "Goodissima Resolution Quality Dashboard",
    `Overall: ${report.passed ? "PASS" : "FAIL"}`,
    `Benchmark cases: ${report.totalBenchmarkCases}`,
    `Pass rate: ${report.passRatePercent}% (${report.benchmarkPassed} passed, ${report.benchmarkFailed} failed)`,
    `Resolved: ${report.resolution.resolved}`,
    `No match: ${report.resolution.noMatch}`,
    `Multiple matches: ${report.resolution.multipleMatches}`,
    `Unmapped paths: ${report.resolution.unmappedPaths}`,
    `Invalid CIRO: ${report.resolution.invalidCiro}`,
    `Governance: ${report.governance.valid ? "PASS" : "FAIL"}`,
    `Governed paths: ${report.governedPathCount}`,
    `Knowledge sources: ${report.sourceCount}`,
    `Expressions: ${report.expressionCount}`,
    `Detector benchmark: ${report.detectorBenchmark.passed}/${report.detectorBenchmark.total}`,
    `CIRO benchmark: ${report.ciroBenchmark.passed}/${report.ciroBenchmark.total}`,
  ].join("\n");
}
