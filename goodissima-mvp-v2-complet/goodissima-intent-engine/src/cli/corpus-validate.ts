import { validateCorpus } from "../corpus/validator.js";
import { fail, loadKnowledge, parseArguments, readCorpus, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (!arguments_.corpus) throw new Error("--corpus is required.");
  const knowledge = await loadKnowledge(arguments_.manifest);
  const result = validateCorpus(
    await readCorpus(arguments_.corpus),
    { documents: await knowledge.list() },
  );
  await writeJson(result, arguments_.output);
  if (!result.valid) process.exitCode = 1;
}

main().catch(fail);
