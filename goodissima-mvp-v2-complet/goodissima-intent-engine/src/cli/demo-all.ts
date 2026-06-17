import { runFrenchMergeDemo } from "../presentation/demo-runner.js";
import {
  DEFAULT_EMPLOYMENT_DEMO_SCENARIO_PATH,
  DEFAULT_FRENCH_PRESENTATION_CATALOG_PATH,
  DEFAULT_HOUSING_DEMO_SCENARIO_PATH,
  DEFAULT_SCORING_RULES_PATH,
  fail,
  writeText,
} from "./shared.js";

async function main(): Promise<void> {
  const common = {
    catalogPath: DEFAULT_FRENCH_PRESENTATION_CATALOG_PATH,
    scoringRulesPath: DEFAULT_SCORING_RULES_PATH,
  };
  const [housing, employment] = await Promise.all([
    runFrenchMergeDemo({ ...common, scenarioPath: DEFAULT_HOUSING_DEMO_SCENARIO_PATH }),
    runFrenchMergeDemo({ ...common, scenarioPath: DEFAULT_EMPLOYMENT_DEMO_SCENARIO_PATH }),
  ]);
  await writeText(`${housing}\n\n${employment}`);
}

main().catch(fail);
