import { readFile } from "node:fs/promises";
import type { Corpus } from "../corpus/types.js";
import type {
  DetectorManifestIssue,
  DetectorManifestValidationResult,
  ExpressionManifest,
  IntentTaxonomy,
  IntentTaxonomyValidationResult,
  ModeCatalog,
  TaxonomyEntry,
  ValidatedDetectorExpression,
} from "./types.js";

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export function readIntentTaxonomy(filePath: string): Promise<IntentTaxonomy> {
  return readJson<IntentTaxonomy>(filePath);
}

export function readExpressionManifest(filePath: string): Promise<ExpressionManifest> {
  return readJson<ExpressionManifest>(filePath);
}

function validateTaxonomyGroup(
  entries: unknown,
  group: "intents" | "modes",
  issues: DetectorManifestIssue[],
): void {
  if (!Array.isArray(entries)) {
    issues.push({ path: `$.${group}`, code: "invalid_taxonomy_group", message: `${group} must be an array.` });
    return;
  }
  const ids = new Set<string>();
  entries.forEach((value, index) => {
    const path = `$.${group}[${index}]`;
    const entry = value as Partial<TaxonomyEntry>;
    if (typeof entry?.id !== "string" || !entry.id.trim()) {
      issues.push({ path: `${path}.id`, code: "invalid_taxonomy_id", message: "id must be a non-empty string." });
      return;
    }
    if (ids.has(entry.id)) {
      issues.push({ path: `${path}.id`, code: "duplicate_taxonomy_id", message: "taxonomy ids must be unique within their group." });
    }
    ids.add(entry.id);
  });
}

export function validateIntentTaxonomy(
  taxonomy: IntentTaxonomy,
  corpus: Corpus,
  modeCatalog?: ModeCatalog,
): IntentTaxonomyValidationResult {
  const issues: DetectorManifestIssue[] = [];
  if (taxonomy?.version !== "1.0") {
    issues.push({ path: "$.version", code: "invalid_taxonomy", message: "Unsupported or invalid intent taxonomy." });
    return { valid: false, issues };
  }
  validateTaxonomyGroup(taxonomy.intents, "intents", issues);
  validateTaxonomyGroup(taxonomy.modes, "modes", issues);
  if (modeCatalog) {
    const approvedModes = new Set(modeCatalog.modes.map(({ id }) => id));
    taxonomy.modes.forEach((mode, index) => {
      if (!approvedModes.has(mode.id)) {
        issues.push({ path: `$.modes[${index}].id`, code: "unknown_mode", message: "Mode is not present in the mode catalog." });
      }
    });
  }
  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, taxonomy, issues: [] };
}

export function validateExpressionManifest(
  manifest: ExpressionManifest,
  taxonomy: IntentTaxonomy,
  corpus: Corpus,
  modeCatalog?: ModeCatalog,
): DetectorManifestValidationResult {
  const issues: DetectorManifestIssue[] = [];
  if (manifest?.version !== "1.0" || !Array.isArray(manifest?.entries)) {
    return {
      valid: false,
      issues: [{ path: "$", code: "invalid_manifest", message: "Unsupported or invalid expression manifest." }],
    };
  }

  const intentIds = new Set(taxonomy.intents.map((entry) => entry.id));
  const taxonomyModeIds = new Set(taxonomy.modes.map((entry) => entry.id));
  const catalogModeIds = new Set((modeCatalog?.modes ?? taxonomy.modes).map((entry) => entry.id));
  const expressions = new Set<string>();
  const validated: ValidatedDetectorExpression[] = [];

  manifest.entries.forEach((entry, index) => {
    const path = `$.entries[${index}]`;
    if (typeof entry.expression !== "string" || !entry.expression.trim()) {
      issues.push({ path: `${path}.expression`, code: "invalid_expression", message: "expression must be a non-empty string." });
      return;
    }
    if (expressions.has(entry.expression)) {
      issues.push({ path: `${path}.expression`, code: "duplicate_expression", message: "expressions must be unique." });
      return;
    }
    expressions.add(entry.expression);

    if (typeof entry.knowledgeId !== "string" || !entry.knowledgeId.trim()) {
      issues.push({ path: `${path}.knowledgeId`, code: "invalid_source", message: "knowledgeId must be a non-empty string." });
      return;
    }
    const sourceExists = corpus.sources.some((source) => source.knowledgeId === entry.knowledgeId);
    if (!sourceExists) {
      issues.push({ path: `${path}.knowledgeId`, code: "invalid_source", message: "knowledgeId is not present in the corpus." });
      return;
    }

    const hasIntent = typeof entry.intent === "string";
    const hasMode = typeof entry.mode === "string";
    if (hasIntent === hasMode) {
      issues.push({ path, code: "invalid_target", message: "Each expression must map to exactly one intent or mode." });
      return;
    }
    if (hasIntent && !intentIds.has(entry.intent!)) {
      issues.push({ path: `${path}.intent`, code: "unknown_intent", message: "intent is not present in the taxonomy." });
      return;
    }
    if (hasMode && (!taxonomyModeIds.has(entry.mode!) || !catalogModeIds.has(entry.mode!))) {
      issues.push({ path: `${path}.mode`, code: "invalid_mode", message: "mode is not present in the taxonomy." });
      return;
    }

    const unit = corpus.units.find(
      (candidate) => candidate.knowledgeId === entry.knowledgeId && candidate.content.includes(entry.expression),
    );
    if (!unit) {
      issues.push({ path, code: "expression_not_source_grounded", message: "expression must occur verbatim in the declared source." });
      return;
    }
    validated.push({
      ...entry,
      kind: hasIntent ? "intent" : "mode",
      label: hasIntent ? entry.intent! : entry.mode!,
      unitId: unit.id,
      locator: unit.locator,
    });
  });

  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, entries: validated, issues: [] };
}
