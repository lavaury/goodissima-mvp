import { runFrenchMergeDemo } from "../presentation/demo-runner.js";
import {
  DEFAULT_FRENCH_PRESENTATION_CATALOG_PATH,
  DEFAULT_HOUSING_DEMO_SCENARIO_PATH,
  DEFAULT_SCORING_RULES_PATH,
  fail,
  writeText,
} from "./shared.js";

runFrenchMergeDemo({
  catalogPath: DEFAULT_FRENCH_PRESENTATION_CATALOG_PATH,
  scenarioPath: DEFAULT_HOUSING_DEMO_SCENARIO_PATH,
  scoringRulesPath: DEFAULT_SCORING_RULES_PATH,
}).then((output) => writeText(output)).catch(fail);
