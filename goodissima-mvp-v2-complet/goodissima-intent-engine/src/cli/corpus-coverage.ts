import { createCorpusCoverageReport } from "../corpus/coverage.js";
import { loadCorpus } from "../corpus/loader.js";
import { fail, loadKnowledge, parseArguments, readCorpus, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  const knowledge = await loadKnowledge(arguments_.manifest);
  const corpus = arguments_.corpus
    ? await readCorpus(arguments_.corpus)
    : await loadCorpus(knowledge);
  await writeJson(
    createCorpusCoverageReport(corpus, await knowledge.list()),
    arguments_.output,
  );
}

main().catch(fail);
