import { validateCiro } from "../ciro/validator.js";
import type {
  BenchmarkDataset,
  BenchmarkReport,
  BenchmarkSubject,
} from "./types.js";

export async function runBenchmark(
  dataset: BenchmarkDataset,
  subject?: BenchmarkSubject,
): Promise<BenchmarkReport> {
  if (dataset.version !== "1.0" || !Array.isArray(dataset.cases)) {
    throw new Error("Unsupported or invalid benchmark dataset.");
  }

  if (!subject) {
    return {
      subject: null,
      total: dataset.cases.length,
      passed: 0,
      failed: 0,
      skipped: dataset.cases.length,
      cases: dataset.cases.map(({ id }) => ({
        id,
        status: "skipped",
        issues: ["No benchmark subject configured."],
      })),
    };
  }

  const cases = [];
  for (const benchmarkCase of dataset.cases) {
    const candidate = await subject.run(benchmarkCase.input);
    const validation = validateCiro(candidate);
    cases.push({
      id: benchmarkCase.id,
      status: validation.valid ? "passed" as const : "failed" as const,
      issues: validation.valid
        ? []
        : validation.issues.map((issue) => `${issue.path}: ${issue.message}`),
    });
  }

  return {
    subject: subject.name,
    total: cases.length,
    passed: cases.filter((result) => result.status === "passed").length,
    failed: cases.filter((result) => result.status === "failed").length,
    skipped: 0,
    cases,
  };
}
