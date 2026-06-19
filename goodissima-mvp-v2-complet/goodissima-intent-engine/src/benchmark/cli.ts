import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBenchmark } from "./runner.js";
import type { BenchmarkDataset } from "./types.js";

async function main(): Promise<void> {
  const defaultDataset = fileURLToPath(
    new URL("../../../knowledge/benchmarks/benchmark.empty.json", import.meta.url),
  );
  const datasetPath = path.resolve(process.argv[2] ?? defaultDataset);
  const dataset = JSON.parse(await readFile(datasetPath, "utf8")) as BenchmarkDataset;
  const report = await runBenchmark(dataset);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Benchmark failed: ${message}\n`);
  process.exitCode = 1;
});
