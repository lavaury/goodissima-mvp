import type { Corpus } from "../corpus/types.js";
import type { ValidatedCiroPath } from "../ciro/path-types.js";
import { validateMergeBenchmark } from "./benchmark-validator.js";
import { validateCompatibilityMatrix } from "./matrix-validator.js";
import { validateScoringRules } from "./scoring-validator.js";
import type {
  CompatibilityMatrix,
  MergeBenchmark,
  MergeValidationIssue,
  ScoringRules,
} from "./types.js";

export type MergeGovernanceResult =
  | {
      valid: true;
      matrixEntries: number;
      scoringRules: number;
      benchmarkCases: number;
      scoringImplemented: true;
      matchingImplemented: false;
      issues: [];
    }
  | { valid: false; issues: MergeValidationIssue[] };

export function validateMergeGovernance(input: {
  matrix: CompatibilityMatrix;
  scoringRules: ScoringRules;
  benchmark: MergeBenchmark;
  corpus: Corpus;
  ciroPaths: readonly ValidatedCiroPath[];
}): MergeGovernanceResult {
  const approvedRelationships = new Set(
    input.ciroPaths.flatMap((path) => {
      const output = path.ciroProjection.o;
      if (typeof output !== "object" || output === null || Array.isArray(output)) return [];
      return typeof output.relationship === "string" ? [output.relationship] : [];
    }),
  );
  const matrix = validateCompatibilityMatrix(
    input.matrix,
    input.corpus,
    approvedRelationships,
  );
  const scoring = validateScoringRules(input.scoringRules, input.corpus);
  if (!matrix.valid || !scoring.valid) {
    const issues: MergeValidationIssue[] = [];
    if (!matrix.valid) issues.push(...matrix.issues);
    if (!scoring.valid) issues.push(...scoring.issues);
    return { valid: false, issues };
  }

  const benchmark = validateMergeBenchmark(input.benchmark, matrix.value);
  if (!benchmark.valid) return { valid: false, issues: benchmark.issues };
  return {
    valid: true,
    matrixEntries: matrix.value.entries.length,
    scoringRules: scoring.value.rules.length,
    benchmarkCases: benchmark.value.cases.length,
    scoringImplemented: true,
    matchingImplemented: false,
    issues: [],
  };
}
