import { validateCiro } from "../ciro/validator.js";
import type { CompatibilityMatrix, MergeBenchmark, MergeValidationIssue, MergeValidationResult } from "./types.js";

export function validateMergeBenchmark(benchmark: MergeBenchmark, matrix: CompatibilityMatrix): MergeValidationResult<MergeBenchmark> {
  const issues: MergeValidationIssue[] = [];
  if (benchmark?.version !== "1.0" || !Array.isArray(benchmark?.cases)) {
    return { valid: false, issues: [{ path: "$", code: "invalid_benchmark", message: "Unsupported or invalid merge benchmark." }] };
  }
  const ids = new Set<string>();
  const coveredEntries = new Set<string>();
  benchmark.cases.forEach((benchmarkCase, index) => {
    const path = `$.cases[${index}]`;
    if (!benchmarkCase.id?.trim() || ids.has(benchmarkCase.id)) issues.push({ path: `${path}.id`, code: "invalid_or_duplicate_id", message: "Benchmark case ids must be non-empty and unique." });
    ids.add(benchmarkCase.id);
    const entry = matrix.entries.find((candidate) => candidate.id === benchmarkCase.matrixEntryId);
    if (!entry) issues.push({ path: `${path}.matrixEntryId`, code: "unknown_matrix_entry", message: "Benchmark case must reference a matrix entry." });
    else coveredEntries.add(entry.id);
    if (!validateCiro(benchmarkCase.ciroA).valid) issues.push({ path: `${path}.ciroA`, code: "invalid_ciro", message: "Benchmark CIRO A must be structurally valid." });
    if (!validateCiro(benchmarkCase.ciroB).valid) issues.push({ path: `${path}.ciroB`, code: "invalid_ciro", message: "Benchmark CIRO B must be structurally valid." });
  });
  matrix.entries.forEach((entry, index) => {
    if (!coveredEntries.has(entry.id)) issues.push({ path: `$.matrix.entries[${index}]`, code: "matrix_entry_without_benchmark", message: `Matrix entry ${entry.id} has no benchmark coverage.` });
  });
  return issues.length ? { valid: false, issues } : { valid: true, value: benchmark, issues: [] };
}
