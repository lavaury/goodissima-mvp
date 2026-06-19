import type { CiroRecord } from "../ciro/model.js";
import { scoreMerge } from "./scoring-engine.js";
import type { MergeScoreResult } from "./types.js";

export interface EvaluateMergeOptions {
  filterNoMatch?: boolean;
}

export interface EvaluatedMergeCandidate extends MergeScoreResult {
  candidateIndex: number;
  candidate: CiroRecord;
}

export function evaluateMerge(
  sourceCiro: CiroRecord,
  candidateCiros: readonly CiroRecord[],
  options: EvaluateMergeOptions = {},
): EvaluatedMergeCandidate[] {
  return candidateCiros
    .map((candidate, candidateIndex) => ({
      candidateIndex,
      candidate,
      ...scoreMerge(sourceCiro, candidate),
    }))
    .filter((candidate) => !options.filterNoMatch || candidate.status !== "NO_MATCH")
    .sort((left, right) => right.totalScore - left.totalScore || left.candidateIndex - right.candidateIndex);
}
