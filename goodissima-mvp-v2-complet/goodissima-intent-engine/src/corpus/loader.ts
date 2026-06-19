import type { KnowledgeAccessLayer, KnowledgeDocument } from "../knowledge/types.js";
import { CORPUS_VERSION, type Corpus, type CorpusUnit } from "./types.js";

interface HeadingMatch {
  lineIndex: number;
  level: number;
  text: string;
}

function splitLines(content: string): string[] {
  return content.split(/\r?\n/u);
}

function headingsIn(lines: readonly string[]): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  lines.forEach((line, lineIndex) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/u.exec(line);
    if (match) {
      headings.push({
        lineIndex,
        level: match[1].length,
        text: match[2],
      });
    }
  });
  return headings;
}

function unitsFromDocument(document: KnowledgeDocument): CorpusUnit[] {
  const lines = splitLines(document.content);
  const headings = headingsIn(lines);
  const starts = headings.length === 0
    ? [{ lineIndex: 0, level: null, text: null }]
    : [
        ...(headings[0].lineIndex > 0
          ? [{ lineIndex: 0, level: null, text: null }]
          : []),
        ...headings,
      ];

  return starts
    .map((start, index) => {
      const endLineIndex = starts[index + 1]?.lineIndex ?? lines.length;
      return {
        id: `${document.id}#unit-${String(index + 1).padStart(4, "0")}`,
        knowledgeId: document.id,
        ordinal: index + 1,
        heading: start.text,
        headingLevel: start.level,
        locator: {
          startLine: start.lineIndex + 1,
          endLine: endLineIndex,
        },
        content: lines.slice(start.lineIndex, endLineIndex).join("\n"),
      } satisfies CorpusUnit;
    })
    .filter((unit) => unit.content.trim().length > 0);
}

export async function loadCorpus(knowledge: KnowledgeAccessLayer): Promise<Corpus> {
  const documents = await knowledge.list();
  return {
    version: CORPUS_VERSION,
    sources: documents.map((document) => ({
      knowledgeId: document.id,
      title: document.title,
      path: document.path,
      lineCount: splitLines(document.content).length,
    })),
    units: documents.flatMap(unitsFromDocument),
  };
}
