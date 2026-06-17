import { loadCorpus } from "../corpus/loader.js";
import { calculateCorpusStatistics } from "../corpus/statistics.js";
import { fail, loadKnowledge, parseArguments, readCorpus, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  const corpus = arguments_.corpus
    ? await readCorpus(arguments_.corpus)
    : await loadCorpus(await loadKnowledge(arguments_.manifest));
  await writeJson(calculateCorpusStatistics(corpus), arguments_.output);
}

main().catch(fail);
