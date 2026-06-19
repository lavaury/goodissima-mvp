import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus } from "../corpus/types.js";
import { FileSystemKnowledgeAccessLayer } from "../knowledge/filesystem.js";

export const DEFAULT_MANIFEST_PATH = fileURLToPath(
  new URL("../../../knowledge/manifests/goodissima.manifest.json", import.meta.url),
);
export const DEFAULT_INTENT_TAXONOMY_PATH = fileURLToPath(
  new URL("../../../knowledge/detector/intent-taxonomy.v0.json", import.meta.url),
);
export const DEFAULT_EXPRESSION_MANIFEST_PATH = fileURLToPath(
  new URL("../../../knowledge/detector/expression-manifest.v0.json", import.meta.url),
);
export const DEFAULT_MODE_CATALOG_PATH = fileURLToPath(
  new URL("../../../knowledge/detector/mode-catalog.v0.json", import.meta.url),
);
export const DEFAULT_CIRO_PATH_MANIFEST_PATH = fileURLToPath(
  new URL("../../../knowledge/ciro/paths.v0.json", import.meta.url),
);
export const DEFAULT_CIRO_BENCHMARK_PATH = fileURLToPath(
  new URL("../../../knowledge/benchmarks/ciro.v0.json", import.meta.url),
);
export const DEFAULT_DETECTOR_BENCHMARK_PATH = fileURLToPath(
  new URL("../../../knowledge/benchmarks/detector.v0.json", import.meta.url),
);
export const DEFAULT_COMPATIBILITY_MATRIX_PATH = fileURLToPath(
  new URL("../../../knowledge/merge/compatibility-matrix.v0.json", import.meta.url),
);
export const DEFAULT_SCORING_RULES_PATH = fileURLToPath(
  new URL("../../../knowledge/merge/scoring-rules.v1.json", import.meta.url),
);
export const DEFAULT_MERGE_BENCHMARK_PATH = fileURLToPath(
  new URL("../../../knowledge/benchmarks/merge-benchmark.v1.json", import.meta.url),
);
export const DEFAULT_FRENCH_PRESENTATION_CATALOG_PATH = fileURLToPath(
  new URL("../../../knowledge/presentation/presentation-catalog.fr.json", import.meta.url),
);
export const DEFAULT_HOUSING_DEMO_SCENARIO_PATH = fileURLToPath(
  new URL("../../../knowledge/demos/merge-housing/scenario.fr.json", import.meta.url),
);
export const DEFAULT_EMPLOYMENT_DEMO_SCENARIO_PATH = fileURLToPath(
  new URL("../../../knowledge/demos/merge-employment/scenario.fr.json", import.meta.url),
);

export interface CliArguments {
  manifest: string;
  corpus?: string;
  output?: string;
  limit?: number;
  input?: string;
  taxonomy?: string;
  expressions?: string;
  benchmark?: string;
  ciroPaths?: string;
  modeCatalog?: string;
  ciroBenchmark?: string;
  trace: boolean;
  detectorBenchmark?: string;
  format: "json" | "text";
  compatibilityMatrix?: string;
  scoringRules?: string;
  mergeBenchmark?: string;
  source?: string;
  candidates?: string;
  filterNoMatch: boolean;
}

export function parseArguments(argv: readonly string[]): CliArguments {
  const values = new Map<string, string>();
  let trace = false;
  let filterNoMatch = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    if (argument === "--trace") {
      trace = true;
      continue;
    }
    if (argument === "--filter-no-match") {
      filterNoMatch = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
    values.set(argument.slice(2), value);
    index += 1;
  }

  const limitValue = values.get("limit");
  const limit = limitValue === undefined ? undefined : Number(limitValue);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new Error("--limit must be a non-negative integer.");
  }
  const formatValue = values.get("format") ?? "json";
  if (formatValue !== "json" && formatValue !== "text") {
    throw new Error("--format must be json or text.");
  }

  return {
    manifest: path.resolve(values.get("manifest") ?? DEFAULT_MANIFEST_PATH),
    corpus: values.get("corpus") ? path.resolve(values.get("corpus")!) : undefined,
    output: values.get("output") ? path.resolve(values.get("output")!) : undefined,
    limit,
    input: values.get("input"),
    taxonomy: values.get("taxonomy")
      ? path.resolve(values.get("taxonomy")!)
      : DEFAULT_INTENT_TAXONOMY_PATH,
    expressions: values.get("expressions")
      ? path.resolve(values.get("expressions")!)
      : DEFAULT_EXPRESSION_MANIFEST_PATH,
    benchmark: values.get("benchmark")
      ? path.resolve(values.get("benchmark")!)
      : undefined,
    ciroPaths: values.get("ciro-paths")
      ? path.resolve(values.get("ciro-paths")!)
      : DEFAULT_CIRO_PATH_MANIFEST_PATH,
    modeCatalog: values.get("mode-catalog")
      ? path.resolve(values.get("mode-catalog")!)
      : DEFAULT_MODE_CATALOG_PATH,
    ciroBenchmark: values.get("ciro-benchmark")
      ? path.resolve(values.get("ciro-benchmark")!)
      : DEFAULT_CIRO_BENCHMARK_PATH,
    trace,
    detectorBenchmark: values.get("detector-benchmark")
      ? path.resolve(values.get("detector-benchmark")!)
      : DEFAULT_DETECTOR_BENCHMARK_PATH,
    format: formatValue,
    compatibilityMatrix: values.get("compatibility-matrix")
      ? path.resolve(values.get("compatibility-matrix")!)
      : DEFAULT_COMPATIBILITY_MATRIX_PATH,
    scoringRules: values.get("scoring-rules")
      ? path.resolve(values.get("scoring-rules")!)
      : DEFAULT_SCORING_RULES_PATH,
    mergeBenchmark: values.get("merge-benchmark")
      ? path.resolve(values.get("merge-benchmark")!)
      : DEFAULT_MERGE_BENCHMARK_PATH,
    source: values.get("source") ? path.resolve(values.get("source")!) : undefined,
    candidates: values.get("candidates") ? path.resolve(values.get("candidates")!) : undefined,
    filterNoMatch,
  };
}

export async function loadKnowledge(manifestPath: string): Promise<FileSystemKnowledgeAccessLayer> {
  return FileSystemKnowledgeAccessLayer.fromManifest(manifestPath);
}

export async function readCorpus(corpusPath: string): Promise<Corpus> {
  return JSON.parse(await readFile(corpusPath, "utf8")) as Corpus;
}

export async function writeJson(value: unknown, outputPath?: string): Promise<void> {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(serialized);
    return;
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
}

export async function writeText(value: string, outputPath?: string): Promise<void> {
  const serialized = value.endsWith("\n") ? value : `${value}\n`;
  if (!outputPath) {
    process.stdout.write(serialized);
    return;
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
}

export function fail(error: unknown): void {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
