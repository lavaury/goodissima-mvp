import { readFile } from "node:fs/promises";
import type { Corpus } from "../corpus/types.js";
import type { DetectorManifestIssue, ModeCatalog } from "./types.js";

export type ModeCatalogValidationResult =
  | { valid: true; catalog: ModeCatalog; issues: [] }
  | { valid: false; issues: DetectorManifestIssue[] };

export async function readModeCatalog(filePath: string): Promise<ModeCatalog> {
  return JSON.parse(await readFile(filePath, "utf8")) as ModeCatalog;
}

export function validateModeCatalog(
  catalog: ModeCatalog,
  corpus: Corpus,
): ModeCatalogValidationResult {
  const issues: DetectorManifestIssue[] = [];
  if (catalog?.version !== "1.0" || !Array.isArray(catalog?.modes)) {
    return { valid: false, issues: [{ path: "$", code: "invalid_mode_catalog", message: "Unsupported or invalid mode catalog." }] };
  }
  const ids = new Set<string>();
  catalog.modes.forEach((mode, index) => {
    const path = `$.modes[${index}]`;
    if (typeof mode.id !== "string" || !mode.id.trim()) {
      issues.push({ path: `${path}.id`, code: "invalid_mode", message: "Mode id must be a non-empty string." });
      return;
    }
    if (ids.has(mode.id)) issues.push({ path: `${path}.id`, code: "duplicate_mode", message: "Mode ids must be unique." });
    ids.add(mode.id);
    const unit = corpus.units.find(
      (candidate) => candidate.knowledgeId === mode.knowledgeId && candidate.content.includes(mode.expression),
    );
    if (!unit) {
      issues.push({ path, code: "mode_not_source_grounded", message: "Mode expression must occur in its declared source." });
    }
  });
  return issues.length > 0 ? { valid: false, issues } : { valid: true, catalog, issues: [] };
}
