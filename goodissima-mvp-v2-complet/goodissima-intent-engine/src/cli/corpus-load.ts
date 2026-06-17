import { loadCorpus } from "../corpus/loader.js";
import { fail, loadKnowledge, parseArguments, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  const knowledge = await loadKnowledge(arguments_.manifest);
  await writeJson(await loadCorpus(knowledge), arguments_.output);
}

main().catch(fail);
