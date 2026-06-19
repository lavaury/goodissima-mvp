import { loadScoringRules } from "../merge/loader.js";
import { validateFrenchMergeDemo } from "./demo-validator.js";
import { loadDemoMergeScenario, loadFrenchPresentationCatalog } from "./loader.js";
import { renderFrenchMergeDemo } from "./merge-demo.js";

export async function runFrenchMergeDemo(input: {
  catalogPath: string;
  scenarioPath: string;
  scoringRulesPath: string;
}): Promise<string> {
  const [catalog, scenario, scoringRules] = await Promise.all([
    loadFrenchPresentationCatalog(input.catalogPath),
    loadDemoMergeScenario(input.scenarioPath),
    loadScoringRules(input.scoringRulesPath),
  ]);
  const maximumScore = validateFrenchMergeDemo(scenario, catalog, scoringRules);
  return renderFrenchMergeDemo(scenario, catalog, maximumScore);
}
