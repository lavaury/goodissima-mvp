import type { Corpus } from "../corpus/types.js";
import type { MergeScoreStatus, MergeValidationIssue, MergeValidationResult, ScoringRules } from "./types.js";

const dimensions = ["relationship", "role", "trust", "family"] as const;
const paths = ["o.relationship", "r.roles", "i.trustPolicy", "c.intent"];
const statuses: MergeScoreStatus[] = ["EXACT_MATCH", "STRONG_MATCH", "RELATED_OPPORTUNITY", "WEAK_SIGNAL", "NO_MATCH"];

export function validateScoringRules(rules: ScoringRules, corpus: Corpus): MergeValidationResult<ScoringRules> {
  const issues: MergeValidationIssue[] = [];
  if (rules?.version !== "1.0" || rules?.implementation !== "DETERMINISTIC_V0" || !Array.isArray(rules?.rules)) {
    return { valid: false, issues: [{ path: "$", code: "invalid_scoring_rules", message: "Unsupported or invalid scoring rules." }] };
  }
  dimensions.forEach((name, index) => {
    const dimension = rules.dimensions?.[name];
    if (!dimension || dimension.path !== paths[index] || dimension.score < 0 || !Number.isInteger(dimension.score)) {
      issues.push({ path: `$.dimensions.${name}`, code: "invalid_dimension", message: "Dimension path and non-negative integer score must be explicit." });
    }
    const expectedComparison = name === "relationship" ? "MATRIX" : "EXACT_JSON";
    if (dimension?.comparison !== expectedComparison) {
      issues.push({ path: `$.dimensions.${name}.comparison`, code: "invalid_comparison", message: "Only governed matrix or exact JSON comparison is supported." });
    }
  });
  const total = dimensions.reduce((sum, name) => sum + (rules.dimensions?.[name]?.score ?? 0), 0);
  if (dimensions.some((name) => rules.dimensions?.[name]?.score !== 1)) issues.push({ path: "$.dimensions", code: "invalid_score_total", message: "v0 dimensions must use equal binary unit scores." });
  if (!Array.isArray(rules.statuses) || rules.statuses.length !== statuses.length) {
    issues.push({ path: "$.statuses", code: "invalid_statuses", message: "Every merge status requires one threshold." });
  } else {
    rules.statuses.forEach((rule, index) => {
      if (rule.status !== statuses[index] || !Number.isInteger(rule.minimumScore) || rule.minimumScore < 0 || rule.minimumScore > total) {
        issues.push({ path: `$.statuses[${index}]`, code: "invalid_status_threshold", message: "Status thresholds must be complete, ordered, and bounded." });
      }
      if (index > 0 && rule.minimumScore >= rules.statuses[index - 1].minimumScore) {
        issues.push({ path: `$.statuses[${index}].minimumScore`, code: "unordered_threshold", message: "Status thresholds must descend." });
      }
    });
  }
  const ids = new Set<string>();
  rules.rules.forEach((rule, index) => {
    const path = `$.rules[${index}]`;
    if (!rule.id?.trim() || ids.has(rule.id)) issues.push({ path: `${path}.id`, code: "invalid_or_duplicate_id", message: "Scoring rule ids must be non-empty and unique." });
    ids.add(rule.id);
    if (rule.requirement !== rule.source?.expression) issues.push({ path: `${path}.requirement`, code: "requirement_source_mismatch", message: "Requirement must equal its exact source expression." });
    const grounded = corpus.units.some((unit) => unit.knowledgeId === rule.source?.knowledgeId && unit.content.includes(rule.source?.expression));
    if (!grounded) issues.push({ path: `${path}.source`, code: "source_not_grounded", message: "Scoring rule source expression must exist in its declared source." });
  });
  return issues.length ? { valid: false, issues } : { valid: true, value: rules, issues: [] };
}
