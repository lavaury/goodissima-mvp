import type { CiroRecord } from "../ciro/model.js";
import type { DetectorCandidate } from "../detector/types.js";
import type { DetectorEvidence } from "../detector/types.js";

export type ResolveIntentStatus =
  | "RESOLVED"
  | "NO_MATCH"
  | "MULTIPLE_MATCHES"
  | "UNMAPPED_PATH"
  | "INVALID_CIRO";

export interface ResolveIntentResult {
  version: "0";
  status: ResolveIntentStatus;
  candidates: DetectorCandidate[];
  ciro: CiroRecord | null;
  issues: string[];
  trace?: ResolutionTrace;
}

export interface ResolveIntentOptions {
  trace?: boolean;
}

export interface RankedCandidateTrace {
  rank: number;
  kind: "intent" | "mode";
  label: string;
  confidence: number;
}

export interface ResolutionTrace {
  matchedExpressions: Array<DetectorEvidence & { candidateKind: "intent" | "mode"; candidateLabel: string }>;
  candidateRanking: RankedCandidateTrace[];
  selectedCiroPath: { intent: string; mode: string } | null;
  governance: { valid: true; governedPaths: number };
  validation: {
    performed: boolean;
    valid: boolean | null;
    issues: string[];
  };
}
