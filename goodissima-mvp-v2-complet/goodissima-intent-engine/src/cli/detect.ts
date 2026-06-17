import { createDeterministicIntentDetectorV0 } from "../detector/factory.js";
import { fail, loadKnowledge, parseArguments, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.input === undefined) throw new Error("--input is required.");
  const detector = await createDeterministicIntentDetectorV0(
    await loadKnowledge(arguments_.manifest),
    arguments_.taxonomy!,
    arguments_.expressions!,
    arguments_.modeCatalog!,
  );
  await writeJson(detector.detect(arguments_.input), arguments_.output);
}

main().catch(fail);
