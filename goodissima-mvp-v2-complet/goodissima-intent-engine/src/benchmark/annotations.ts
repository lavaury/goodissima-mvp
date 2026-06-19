import type { Corpus } from "../corpus/types.js";
import type { ExpressionManifest } from "../detector/types.js";
import type { BenchmarkCase, BenchmarkDataset } from "./types.js";

export interface BenchmarkAnnotationIssue {
  path: string;
  code: string;
  message: string;
}

export type BenchmarkAnnotationValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: BenchmarkAnnotationIssue[] };

export function benchmarkCaseText(benchmarkCase: BenchmarkCase): string {
  const input = benchmarkCase.input;
  if (typeof input !== "object" || input === null || Array.isArray(input) || typeof input.text !== "string") {
    throw new Error(`Benchmark case ${benchmarkCase.id} must contain input.text.`);
  }
  const annotations = benchmarkCase.sourceAnnotations ?? [];
  return [input.text, ...annotations.map(({ expression }) => expression)].join(" ");
}

export function validateBenchmarkAnnotations(
  dataset: BenchmarkDataset,
  expressionManifest: ExpressionManifest,
  corpus: Corpus,
): BenchmarkAnnotationValidationResult {
  const issues: BenchmarkAnnotationIssue[] = [];
  dataset.cases.forEach((benchmarkCase, caseIndex) => {
    (benchmarkCase.sourceAnnotations ?? []).forEach((annotation, annotationIndex) => {
      const path = `$.cases[${caseIndex}].sourceAnnotations[${annotationIndex}]`;
      const manifestEntry = expressionManifest.entries.find(
        (entry) =>
          entry.expression === annotation.expression &&
          entry.knowledgeId === annotation.knowledgeId &&
          (annotation.kind === "intent" ? entry.intent === annotation.label : entry.mode === annotation.label),
      );
      if (!manifestEntry) {
        issues.push({
          path,
          code: "annotation_not_in_expression_manifest",
          message: "Annotation must exactly match a governed expression manifest entry.",
        });
        return;
      }
      const grounded = corpus.units.some(
        (unit) =>
          unit.knowledgeId === annotation.knowledgeId &&
          unit.content.includes(annotation.expression),
      );
      if (!grounded) {
        issues.push({
          path,
          code: "annotation_not_source_grounded",
          message: "Annotation expression must occur in its declared source.",
        });
      }
    });
  });
  return issues.length > 0 ? { valid: false, issues } : { valid: true, issues: [] };
}
