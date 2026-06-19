import { generateBenchmark } from "../benchmark/generator.js";
import { loadCorpus } from "../corpus/loader.js";
import { fail, loadKnowledge, parseArguments, readCorpus, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  const corpus = arguments_.corpus
    ? await readCorpus(arguments_.corpus)
    : await loadCorpus(await loadKnowledge(arguments_.manifest));
  await writeJson(
    generateBenchmark(corpus, { limit: arguments_.limit }),
    arguments_.output,
  );
}

main().catch(fail);
