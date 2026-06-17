import { CORPUS_VERSION, type Corpus, type CorpusValidationIssue, type CorpusValidationOptions, type CorpusValidationResult } from "./types.js";

function issue(
  issues: CorpusValidationIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

function linesOf(content: string): string[] {
  return content.split(/\r?\n/u);
}

export function validateCorpus(
  corpus: Corpus,
  options: CorpusValidationOptions = {},
): CorpusValidationResult {
  const issues: CorpusValidationIssue[] = [];
  if (!corpus || corpus.version !== CORPUS_VERSION) {
    issue(issues, "$.version", "unsupported_version", `version must be ${CORPUS_VERSION}.`);
  }
  if (!Array.isArray(corpus?.sources)) {
    issue(issues, "$.sources", "invalid_sources", "sources must be an array.");
  }
  if (!Array.isArray(corpus?.units)) {
    issue(issues, "$.units", "invalid_units", "units must be an array.");
  }
  if (issues.length > 0) return { valid: false, issues };

  const sourceIds = new Set<string>();
  corpus.sources.forEach((source, index) => {
    const path = `$.sources[${index}]`;
    if (!source.knowledgeId?.trim()) issue(issues, `${path}.knowledgeId`, "required", "knowledgeId is required.");
    if (sourceIds.has(source.knowledgeId)) issue(issues, `${path}.knowledgeId`, "duplicate", "knowledgeId must be unique.");
    sourceIds.add(source.knowledgeId);
    if (!source.title?.trim()) issue(issues, `${path}.title`, "required", "title is required.");
    if (!source.path?.trim()) issue(issues, `${path}.path`, "required", "path is required.");
    if (!Number.isInteger(source.lineCount) || source.lineCount < 1) issue(issues, `${path}.lineCount`, "invalid_line_count", "lineCount must be a positive integer.");
  });

  const unitIds = new Set<string>();
  const ordinals = new Map<string, Set<number>>();
  corpus.units.forEach((unit, index) => {
    const path = `$.units[${index}]`;
    if (!unit.id?.trim()) issue(issues, `${path}.id`, "required", "id is required.");
    if (unitIds.has(unit.id)) issue(issues, `${path}.id`, "duplicate", "unit id must be unique.");
    unitIds.add(unit.id);
    if (!sourceIds.has(unit.knowledgeId)) issue(issues, `${path}.knowledgeId`, "unknown_source", "knowledgeId must reference corpus.sources.");
    if (!Number.isInteger(unit.ordinal) || unit.ordinal < 1) issue(issues, `${path}.ordinal`, "invalid_ordinal", "ordinal must be a positive integer.");
    const sourceOrdinals = ordinals.get(unit.knowledgeId) ?? new Set<number>();
    if (sourceOrdinals.has(unit.ordinal)) issue(issues, `${path}.ordinal`, "duplicate_ordinal", "ordinal must be unique within a source.");
    sourceOrdinals.add(unit.ordinal);
    ordinals.set(unit.knowledgeId, sourceOrdinals);
    if (!unit.content?.trim()) issue(issues, `${path}.content`, "empty_content", "content must not be empty.");
    if (!Number.isInteger(unit.locator?.startLine) || unit.locator.startLine < 1) issue(issues, `${path}.locator.startLine`, "invalid_locator", "startLine must be a positive integer.");
    if (!Number.isInteger(unit.locator?.endLine) || unit.locator.endLine < unit.locator.startLine) issue(issues, `${path}.locator.endLine`, "invalid_locator", "endLine must be greater than or equal to startLine.");
    const source = corpus.sources.find((candidate) => candidate.knowledgeId === unit.knowledgeId);
    if (source && unit.locator.endLine > source.lineCount) issue(issues, `${path}.locator.endLine`, "locator_out_of_bounds", "endLine exceeds the source line count.");
  });

  if (options.documents) {
    const documents = new Map(options.documents.map((document) => [document.id, document]));
    corpus.sources.forEach((source, index) => {
      if (!documents.has(source.knowledgeId)) issue(issues, `$.sources[${index}].knowledgeId`, "missing_document", "Source is not present in the Knowledge Access Layer.");
    });
    corpus.units.forEach((unit, index) => {
      const document = documents.get(unit.knowledgeId);
      if (!document) return;
      const expected = linesOf(document.content)
        .slice(unit.locator.startLine - 1, unit.locator.endLine)
        .join("\n");
      if (unit.content !== expected) issue(issues, `$.units[${index}].content`, "source_mismatch", "content does not match its source locator.");
    });
  }

  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}
