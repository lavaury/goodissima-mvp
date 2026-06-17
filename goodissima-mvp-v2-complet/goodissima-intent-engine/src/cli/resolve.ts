import { createResolveIntentV0 } from "../resolve/factory.js";
import { fail, loadKnowledge, parseArguments, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.input === undefined) throw new Error("--input is required.");
  const resolve = await createResolveIntentV0(
    await loadKnowledge(arguments_.manifest),
    arguments_.taxonomy!,
    arguments_.expressions!,
    arguments_.ciroPaths!,
    arguments_.modeCatalog!,
    arguments_.ciroBenchmark!,
  );
  await writeJson(
    resolve(arguments_.input, { trace: arguments_.trace }),
    arguments_.output,
  );
}

main().catch(fail);
