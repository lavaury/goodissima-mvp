import type { Corpus } from "../corpus/types.js";
import type {
  CompatibilityMatrix,
  MergeValidationIssue,
  MergeValidationResult,
} from "./types.js";

export function validateCompatibilityMatrix(
  matrix: CompatibilityMatrix,
  corpus: Corpus,
  approvedRelationships: ReadonlySet<string>,
): MergeValidationResult<CompatibilityMatrix> {
  const issues: MergeValidationIssue[] = [];
  if (matrix?.version !== "1.0" || !Array.isArray(matrix?.entries)) {
    return {
      valid: false,
      issues: [{ path: "$", code: "invalid_matrix", message: "Unsupported or invalid compatibility matrix." }],
    };
  }
  const ids = new Set<string>();
  const pairs = new Set<string>();
  matrix.entries.forEach((entry, index) => {
    const path = `$.entries[${index}]`;
    if (typeof entry.id !== "string" || !entry.id.trim()) {
      issues.push({ path: `${path}.id`, code: "invalid_id", message: "Matrix entry id is required." });
    } else if (ids.has(entry.id)) {
      issues.push({ path: `${path}.id`, code: "duplicate_id", message: "Matrix entry ids must be unique." });
    }
    ids.add(entry.id);

    if (!approvedRelationships.has(entry.leftRelationship)) {
      issues.push({ path: `${path}.leftRelationship`, code: "unknown_relationship", message: "Left relationship is not governed by a CIRO path." });
    }
    if (!approvedRelationships.has(entry.rightRelationship)) {
      issues.push({ path: `${path}.rightRelationship`, code: "unknown_relationship", message: "Right relationship is not governed by a CIRO path." });
    }
    const pair = `${entry.leftRelationship}\u0000${entry.rightRelationship}`;
    if (pairs.has(pair)) {
      issues.push({ path, code: "duplicate_pair", message: "Relationship pairs must be unique." });
    }
    pairs.add(pair);
    if (entry.compatible !== true) {
      issues.push({ path: `${path}.compatible`, code: "unsupported_declaration", message: "v0 only declares explicitly compatible pairs." });
    }
    const grounded = corpus.units.some(
      (unit) =>
        unit.knowledgeId === entry.source?.knowledgeId &&
        unit.content.includes(entry.source?.expression),
    );
    if (!grounded) {
      issues.push({ path: `${path}.source`, code: "source_not_grounded", message: "Matrix source expression must exist in its declared source." });
    }
  });
  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, value: matrix, issues: [] };
}
