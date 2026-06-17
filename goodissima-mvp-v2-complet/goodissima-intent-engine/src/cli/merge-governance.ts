import { runMergeGovernance } from "../merge/runner.js";
import { fail, loadKnowledge, parseArguments, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  const report = await runMergeGovernance({
    knowledge: await loadKnowledge(arguments_.manifest),
    taxonomyPath: arguments_.taxonomy!,
    modeCatalogPath: arguments_.modeCatalog!,
    ciroPathManifestPath: arguments_.ciroPaths!,
    compatibilityMatrixPath: arguments_.compatibilityMatrix!,
    scoringRulesPath: arguments_.scoringRules!,
    mergeBenchmarkPath: arguments_.mergeBenchmark!,
  });
  await writeJson(report, arguments_.output);
  if (!report.valid) process.exitCode = 1;
}

main().catch(fail);
