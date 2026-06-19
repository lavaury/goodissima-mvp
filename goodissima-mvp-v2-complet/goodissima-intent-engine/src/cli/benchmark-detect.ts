import { readFile } from "node:fs/promises";
import { runDetectorBenchmark } from "../benchmark/detector-runner.js";
import type { BenchmarkDataset } from "../benchmark/types.js";
import { createDeterministicIntentDetectorV0 } from "../detector/factory.js";
import { fail, loadKnowledge, parseArguments, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (!arguments_.benchmark) throw new Error("--benchmark is required.");
  const detector = await createDeterministicIntentDetectorV0(
    await loadKnowledge(arguments_.manifest),
    arguments_.taxonomy!,
    arguments_.expressions!,
    arguments_.modeCatalog!,
  );
  const dataset = JSON.parse(
    await readFile(arguments_.benchmark, "utf8"),
  ) as BenchmarkDataset;
  await writeJson(
    await runDetectorBenchmark(dataset, detector),
    arguments_.output,
  );
}

main().catch(fail);
