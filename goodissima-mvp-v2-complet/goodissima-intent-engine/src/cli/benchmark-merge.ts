import { runMergeBenchmark } from "../merge/benchmark-runner.js";
import { loadCompatibilityMatrix, loadMergeBenchmark, loadScoringRules } from "../merge/loader.js";
import { fail, parseArguments, writeJson } from "./shared.js";

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const report = runMergeBenchmark(
    await loadMergeBenchmark(args.mergeBenchmark!),
    await loadCompatibilityMatrix(args.compatibilityMatrix!),
    await loadScoringRules(args.scoringRules!),
  );
  await writeJson(report, args.output);
  if (report.failed > 0) process.exitCode = 1;
}

main().catch(fail);
