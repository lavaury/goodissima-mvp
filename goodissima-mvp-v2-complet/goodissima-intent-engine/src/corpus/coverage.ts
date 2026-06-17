import type { KnowledgeDocument } from "../knowledge/types.js";
import type { Corpus, CorpusCoverageReport } from "./types.js";

function percent(covered: number, total: number): number {
  if (total === 0) return 100;
  return Number(((covered / total) * 100).toFixed(2));
}

export function createCorpusCoverageReport(
  corpus: Corpus,
  documents: readonly KnowledgeDocument[],
): CorpusCoverageReport {
  const unitsBySource = new Map(
    documents.map((document) => [
      document.id,
      corpus.units.filter((unit) => unit.knowledgeId === document.id),
    ]),
  );

  const bySource = documents.map((document) => {
    const lines = document.content.split(/\r?\n/u);
    const nonEmptyLineNumbers = new Set(
      lines.flatMap((line, index) => line.trim() ? [index + 1] : []),
    );
    const covered = new Set<number>();
    for (const unit of unitsBySource.get(document.id) ?? []) {
      for (let line = unit.locator.startLine; line <= unit.locator.endLine; line += 1) {
        if (nonEmptyLineNumbers.has(line)) covered.add(line);
      }
    }
    const totalNonEmptyLines = nonEmptyLineNumbers.size;
    const coveredNonEmptyLines = covered.size;
    return {
      knowledgeId: document.id,
      present: corpus.sources.some((source) => source.knowledgeId === document.id),
      totalNonEmptyLines,
      coveredNonEmptyLines,
      coveragePercent: percent(coveredNonEmptyLines, totalNonEmptyLines),
    };
  });

  const coveredSources = bySource.filter(
    (source) => source.present && source.coveragePercent === 100,
  ).length;
  const totalNonEmptyLines = bySource.reduce(
    (total, source) => total + source.totalNonEmptyLines,
    0,
  );
  const coveredNonEmptyLines = bySource.reduce(
    (total, source) => total + source.coveredNonEmptyLines,
    0,
  );
  const missingKnowledgeIds = bySource
    .filter((source) => !source.present || source.coveragePercent < 100)
    .map((source) => source.knowledgeId);

  return {
    version: "1.0",
    complete: missingKnowledgeIds.length === 0,
    manifestSources: documents.length,
    coveredSources,
    sourceCoveragePercent: percent(coveredSources, documents.length),
    totalNonEmptyLines,
    coveredNonEmptyLines,
    lineCoveragePercent: percent(coveredNonEmptyLines, totalNonEmptyLines),
    missingKnowledgeIds,
    bySource,
  };
}
