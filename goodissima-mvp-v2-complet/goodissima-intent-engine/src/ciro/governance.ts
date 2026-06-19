import type { BenchmarkDataset } from "../benchmark/types.js";
import type { Corpus } from "../corpus/types.js";
import { validateExpressionManifest, validateIntentTaxonomy } from "../detector/manifest.js";
import { validateModeCatalog } from "../detector/mode-catalog.js";
import type { ExpressionManifest, IntentTaxonomy, ModeCatalog } from "../detector/types.js";
import type { CiroRecord } from "./model.js";
import { validateCiroPathManifest } from "./path-manifest.js";
import type { CiroPathManifest, ValidatedCiroPath } from "./path-types.js";
import { validateCiro } from "./validator.js";
import { validateBenchmarkAnnotations } from "../benchmark/annotations.js";

export interface CiroGovernanceIssue {
  path: string;
  code: string;
  message: string;
}

export type CiroGovernanceResult =
  | { valid: true; paths: ValidatedCiroPath[]; issues: [] }
  | { valid: false; issues: CiroGovernanceIssue[] };

export interface CiroGovernanceInput {
  taxonomy: IntentTaxonomy;
  modeCatalog: ModeCatalog;
  expressionManifest: ExpressionManifest;
  pathManifest: CiroPathManifest;
  benchmark: BenchmarkDataset;
  corpus: Corpus;
}

export function validateCiroPathGovernance(input: CiroGovernanceInput): CiroGovernanceResult {
  const issues: CiroGovernanceIssue[] = [];
  const modeValidation = validateModeCatalog(input.modeCatalog, input.corpus);
  if (!modeValidation.valid) issues.push(...modeValidation.issues);
  const taxonomyValidation = validateIntentTaxonomy(input.taxonomy, input.corpus, input.modeCatalog);
  if (!taxonomyValidation.valid) issues.push(...taxonomyValidation.issues);
  const expressionValidation = validateExpressionManifest(
    input.expressionManifest,
    input.taxonomy,
    input.corpus,
    input.modeCatalog,
  );
  if (!expressionValidation.valid) issues.push(...expressionValidation.issues);
  const annotationValidation = validateBenchmarkAnnotations(
    input.benchmark,
    input.expressionManifest,
    input.corpus,
  );
  if (!annotationValidation.valid) issues.push(...annotationValidation.issues);
  if (issues.length > 0) return { valid: false, issues };

  let paths: ValidatedCiroPath[];
  try {
    paths = validateCiroPathManifest(input.pathManifest, input.taxonomy, input.corpus, input.modeCatalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("unknown intent")
      ? "unknown_intent"
      : message.includes("unknown mode")
        ? "unknown_mode"
        : message.includes("not source-grounded")
          ? "path_without_source"
          : "invalid_path";
    return { valid: false, issues: [{ path: "$.paths", code, message }] };
  }

  const benchmarkKeys = new Set(
    input.benchmark.cases.flatMap((benchmarkCase) => {
      const c = benchmarkCase.expected?.c;
      if (typeof c !== "object" || c === null || Array.isArray(c)) return [];
      return typeof c.intent === "string" && typeof c.mode === "string"
        ? [`${c.intent}\u0000${c.mode}`]
        : [];
    }),
  );

  paths.forEach((path, index) => {
    const key = `${path.intent}\u0000${path.mode}`;
    if (!benchmarkKeys.has(key)) {
      issues.push({
        path: `$.paths[${index}]`,
        code: "path_without_benchmark",
        message: `CIRO path ${path.intent}/${path.mode} has no benchmark expectation.`,
      });
    }
    const candidate: CiroRecord = {
      schemaVersion: "1.0",
      ...path.ciroProjection,
      sources: [path.roleEvidence, path.relationshipEvidence].map((evidence) => ({
        knowledgeId: evidence.knowledgeId,
        locator: `line:${evidence.locator.startLine}-${evidence.locator.endLine}`,
      })),
    };
    const structural = validateCiro(candidate);
    if (!structural.valid) {
      issues.push({
        path: `$.paths[${index}].ciroProjection`,
        code: "invalid_ciro_structure",
        message: structural.issues[0].message,
      });
    }
  });

  return issues.length > 0 ? { valid: false, issues } : { valid: true, paths, issues: [] };
}
