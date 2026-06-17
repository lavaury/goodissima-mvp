import type { Corpus, CorpusSourceStatistics, CorpusStatistics } from "./types.js";

function metrics(content: string): Omit<CorpusSourceStatistics, "knowledgeId" | "units" | "lines"> {
  const lines = content.split(/\r?\n/u);
  return {
    nonEmptyLines: lines.filter((line) => line.trim().length > 0).length,
    characters: content.length,
    words: content.trim() ? content.trim().split(/\s+/u).length : 0,
  };
}

export function calculateCorpusStatistics(corpus: Corpus): CorpusStatistics {
  const bySource = corpus.sources.map((source) => {
    const units = corpus.units.filter((unit) => unit.knowledgeId === source.knowledgeId);
    const content = units.map((unit) => unit.content).join("\n");
    return {
      knowledgeId: source.knowledgeId,
      units: units.length,
      lines: source.lineCount,
      ...metrics(content),
    };
  });

  return {
    version: "1.0",
    sources: corpus.sources.length,
    units: corpus.units.length,
    lines: bySource.reduce((total, source) => total + source.lines, 0),
    nonEmptyLines: bySource.reduce((total, source) => total + source.nonEmptyLines, 0),
    characters: bySource.reduce((total, source) => total + source.characters, 0),
    words: bySource.reduce((total, source) => total + source.words, 0),
    bySource,
  };
}
