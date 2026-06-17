import { readFile } from "node:fs/promises";
import { runCiroBenchmark } from "../benchmark/ciro-runner.js";
import type { BenchmarkDataset } from "../benchmark/types.js";
import { createCiroBuilderV0 } from "../ciro/path-factory.js";
import { fail, loadKnowledge, parseArguments, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (!arguments_.benchmark) throw new Error("--benchmark is required.");
  const builder = await createCiroBuilderV0(
    await loadKnowledge(arguments_.manifest),
    arguments_.taxonomy!,
    arguments_.expressions!,
    arguments_.ciroPaths!,
    arguments_.modeCatalog!,
    arguments_.benchmark!,
  );
  const dataset = JSON.parse(await readFile(arguments_.benchmark, "utf8")) as BenchmarkDataset;
  const report = runCiroBenchmark(dataset, builder);
  await writeJson(report, arguments_.output);
  if (report.failed > 0) process.exitCode = 1;
}

main().catch(fail);
