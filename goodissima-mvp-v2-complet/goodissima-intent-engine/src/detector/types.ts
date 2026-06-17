import type { CorpusLocator } from "../corpus/types.js";

export type DetectorCandidateKind = "intent" | "mode";
export type DetectorMatchType =
  | "exact"
  | "exact_substring"
  | "normalized"
  | "normalized_substring";

export interface TaxonomyEntry {
  id: string;
  knowledgeId?: string;
}

export interface IntentTaxonomy {
  version: "1.0";
  intents: TaxonomyEntry[];
  modes: TaxonomyEntry[];
}

export interface ModeCatalogEntry {
  id: string;
  knowledgeId: string;
  expression: string;
}

export interface ModeCatalog {
  version: "1.0";
  modes: ModeCatalogEntry[];
}

export interface ExpressionManifestEntry {
  expression: string;
  knowledgeId: string;
  intent?: string;
  mode?: string;
}

export interface ExpressionManifest {
  version: "1.0";
  entries: ExpressionManifestEntry[];
}

export interface ValidatedDetectorExpression extends ExpressionManifestEntry {
  kind: DetectorCandidateKind;
  label: string;
  unitId: string;
  locator: CorpusLocator;
}

export interface DetectorEvidence {
  knowledgeId: string;
  unitId: string;
  locator: CorpusLocator;
  expression: string;
  matchType: DetectorMatchType;
}

export interface DetectorCandidate {
  kind: DetectorCandidateKind;
  label: string;
  confidence: number;
  evidence: DetectorEvidence[];
}

export interface IntentDetectionResult {
  version: "0";
  candidates: DetectorCandidate[];
  ambiguous: boolean;
}

export interface DetectorManifestIssue {
  path: string;
  code: string;
  message: string;
}

export type DetectorManifestValidationResult =
  | { valid: true; entries: ValidatedDetectorExpression[]; issues: [] }
  | { valid: false; issues: DetectorManifestIssue[] };

export type IntentTaxonomyValidationResult =
  | { valid: true; taxonomy: IntentTaxonomy; issues: [] }
  | { valid: false; issues: DetectorManifestIssue[] };
