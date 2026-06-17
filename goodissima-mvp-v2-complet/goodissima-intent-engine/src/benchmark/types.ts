import type { CiroRecord, JsonValue } from "../ciro/model.js";

export interface BenchmarkCase {
  id: string;
  input: JsonValue;
  sourceAnnotations?: Array<{
    expression: string;
    knowledgeId: string;
    kind: "intent" | "mode";
    label: string;
  }>;
  expected?: CiroRecord;
  expectedDetection?: {
    candidates: Array<{ kind: "intent" | "mode"; label: string }>;
    ambiguous: boolean;
  };
}

export interface BenchmarkDataset {
  version: "1.0";
  cases: BenchmarkCase[];
}

export interface BenchmarkSubject {
  name: string;
  run(input: JsonValue): Promise<unknown>;
}

export interface BenchmarkCaseResult {
  id: string;
  status: "passed" | "failed" | "skipped";
  issues: string[];
}

export interface BenchmarkReport {
  subject: string | null;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  cases: BenchmarkCaseResult[];
}
