import type { KnowledgeDocument } from "../knowledge/types.js";

export const CORPUS_VERSION = "1.0" as const;

export interface CorpusLocator {
  startLine: number;
  endLine: number;
}

export interface CorpusSource {
  knowledgeId: string;
  title: string;
  path: string;
  lineCount: number;
}

export interface CorpusUnit {
  id: string;
  knowledgeId: string;
  ordinal: number;
  heading: string | null;
  headingLevel: number | null;
  locator: CorpusLocator;
  content: string;
}

export interface Corpus {
  version: typeof CORPUS_VERSION;
  sources: CorpusSource[];
  units: CorpusUnit[];
}

export interface CorpusValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type CorpusValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: CorpusValidationIssue[] };

export interface CorpusValidationOptions {
  documents?: readonly KnowledgeDocument[];
}

export interface CorpusSourceStatistics {
  knowledgeId: string;
  units: number;
  lines: number;
  nonEmptyLines: number;
  characters: number;
  words: number;
}

export interface CorpusStatistics {
  version: "1.0";
  sources: number;
  units: number;
  lines: number;
  nonEmptyLines: number;
  characters: number;
  words: number;
  bySource: CorpusSourceStatistics[];
}

export interface CorpusSourceCoverage {
  knowledgeId: string;
  present: boolean;
  totalNonEmptyLines: number;
  coveredNonEmptyLines: number;
  coveragePercent: number;
}

export interface CorpusCoverageReport {
  version: "1.0";
  complete: boolean;
  manifestSources: number;
  coveredSources: number;
  sourceCoveragePercent: number;
  totalNonEmptyLines: number;
  coveredNonEmptyLines: number;
  lineCoveragePercent: number;
  missingKnowledgeIds: string[];
  bySource: CorpusSourceCoverage[];
}
