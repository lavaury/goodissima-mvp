export interface MergeSourceReference {
  knowledgeId: string;
  expression: string;
}

export interface CompatibilityMatrixEntry {
  id: string;
  leftRelationship: string;
  rightRelationship: string;
  compatible: boolean;
  source: MergeSourceReference;
}

export interface CompatibilityMatrix {
  version: "1.0";
  entries: CompatibilityMatrixEntry[];
}

export interface ScoringRule {
  id: string;
  requirement: string;
  source: MergeSourceReference;
}

export type MergeScoreStatus =
  | "EXACT_MATCH"
  | "STRONG_MATCH"
  | "RELATED_OPPORTUNITY"
  | "WEAK_SIGNAL"
  | "NO_MATCH";

export interface ScoreDimensionRule {
  path: string;
  comparison: "MATRIX" | "EXACT_JSON";
  score: number;
}

export interface ScoreStatusRule {
  status: MergeScoreStatus;
  minimumScore: number;
}

export interface ScoringRules {
  version: "1.0";
  implementation: "DETERMINISTIC_V0";
  dimensions: {
    relationship: ScoreDimensionRule;
    role: ScoreDimensionRule;
    trust: ScoreDimensionRule;
    family: ScoreDimensionRule;
  };
  statuses: ScoreStatusRule[];
  rules: ScoringRule[];
}

export interface MergeBenchmarkCase {
  id: string;
  matrixEntryId: string;
  ciroA: import("../ciro/model.js").CiroRecord;
  ciroB: import("../ciro/model.js").CiroRecord;
  expected: Omit<MergeScoreResult, "explanation">;
}

export interface MergeBenchmark {
  version: "1.0";
  cases: MergeBenchmarkCase[];
}

export interface MergeScoreResult {
  relationshipScore: number;
  roleScore: number;
  trustScore: number;
  familyScore: number;
  totalScore: number;
  status: MergeScoreStatus;
  explanation: string[];
}

export interface MergeValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type MergeValidationResult<T> =
  | { valid: true; value: T; issues: [] }
  | { valid: false; issues: MergeValidationIssue[] };
