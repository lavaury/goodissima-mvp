import { validateCiro } from "../ciro/validator.js";
import type { ScoringRules } from "../merge/types.js";
import type { DemoMergeScenario, FrenchPresentationCatalog } from "./types.js";

const knownDemoKnowledgeIds = new Set([
  "goodissima-trust-architecture",
  "goodissima-matching-governance",
]);

export function validateFrenchMergeDemo(
  scenario: DemoMergeScenario,
  catalog: FrenchPresentationCatalog,
  scoringRules: ScoringRules,
): number {
  if (scenario.candidates.length !== 3) {
    throw new Error("A merge demo requires exactly three candidate fixtures.");
  }

  for (const fixture of [scenario.requester, ...scenario.candidates]) {
    const validation = validateCiro(fixture.ciro, {
      knownKnowledgeIds: knownDemoKnowledgeIds,
    });
    if (!validation.valid) {
      throw new Error(`Invalid governed demo CIRO ${fixture.presentationId}: ${validation.issues[0].message}`);
    }
    if (fixture !== scenario.requester && !catalog.labels[fixture.presentationId]) {
      throw new Error(`Missing presentation label: ${fixture.presentationId}.`);
    }
  }

  const maximumScore = Object.values(scoringRules.dimensions).reduce(
    (sum, dimension) => sum + dimension.score,
    0,
  );
  if (maximumScore <= 0) throw new Error("Demo scoring capacity must be positive.");
  return maximumScore;
}
