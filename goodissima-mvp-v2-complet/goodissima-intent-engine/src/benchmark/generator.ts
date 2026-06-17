import type { Corpus } from "../corpus/types.js";
import { validateCorpus } from "../corpus/validator.js";
import type { BenchmarkDataset } from "./types.js";

export interface BenchmarkGenerationOptions {
  limit?: number;
}

export function generateBenchmark(
  corpus: Corpus,
  options: BenchmarkGenerationOptions = {},
): BenchmarkDataset {
  const validation = validateCorpus(corpus);
  if (!validation.valid) {
    throw new Error(`Cannot generate a benchmark from an invalid corpus: ${validation.issues[0].message}`);
  }

  const limit = options.limit ?? corpus.units.length;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("Benchmark limit must be a non-negative integer.");
  }

  return {
    version: "1.0",
    cases: corpus.units.slice(0, limit).map((unit) => ({
      id: unit.id,
      input: {
        text: unit.content,
        source: {
          knowledgeId: unit.knowledgeId,
          locator: `line:${unit.locator.startLine}-${unit.locator.endLine}`,
        },
      },
    })),
  };
}
