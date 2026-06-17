import { renderResolutionQualityText } from "../quality/dashboard.js";
import { runResolutionQualityDashboard } from "../quality/runner.js";
import { fail, loadKnowledge, parseArguments, writeJson, writeText } from "./shared.js";

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  const report = await runResolutionQualityDashboard({
    knowledge: await loadKnowledge(arguments_.manifest),
    taxonomyPath: arguments_.taxonomy!,
    expressionManifestPath: arguments_.expressions!,
    modeCatalogPath: arguments_.modeCatalog!,
    ciroPathManifestPath: arguments_.ciroPaths!,
    detectorBenchmarkPath: arguments_.detectorBenchmark!,
    ciroBenchmarkPath: arguments_.ciroBenchmark!,
  });
  if (arguments_.format === "text") {
    await writeText(renderResolutionQualityText(report), arguments_.output);
  } else {
    await writeJson(report, arguments_.output);
  }
  if (!report.passed) process.exitCode = 1;
}

main().catch(fail);
