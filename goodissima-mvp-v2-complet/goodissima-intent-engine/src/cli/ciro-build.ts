import { createCiroBuilderV0 } from "../ciro/path-factory.js";
import { fail, loadKnowledge, parseArguments, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.input === undefined) throw new Error("--input is required.");
  const builder = await createCiroBuilderV0(
    await loadKnowledge(arguments_.manifest),
    arguments_.taxonomy!,
    arguments_.expressions!,
    arguments_.ciroPaths!,
    arguments_.modeCatalog!,
    arguments_.ciroBenchmark!,
  );
  const ciro = builder.build(arguments_.input);
  if (!ciro) throw new Error("No complete explicit CIRO path matched the input.");
  await writeJson(ciro, arguments_.output);
}

main().catch(fail);
