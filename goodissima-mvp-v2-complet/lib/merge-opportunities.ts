import path from "node:path";
import { evaluateMerge } from "../goodissima-intent-engine/dist/src/merge/candidate-evaluator.js";
import { loadScoringRules } from "../goodissima-intent-engine/dist/src/merge/loader.js";
import { validateFrenchMergeDemo } from "../goodissima-intent-engine/dist/src/presentation/demo-validator.js";
import { loadDemoMergeScenario, loadFrenchPresentationCatalog } from "../goodissima-intent-engine/dist/src/presentation/loader.js";

export type MergeOpportunityScenario = "housing" | "employment";

export type MergeOpportunity = {
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  relationalScore: number;
  explanations: string[];
  scoreBreakdown: {
    relationshipScore: number;
    roleScore: number;
    trustScore: number;
    familyScore: number;
    totalScore: number;
  };
  ciro: unknown;
};

const reasonDimensions = ["relationship", "role", "trust", "family"] as const;

export async function getDemoMergeOpportunities(
  scenarioId: MergeOpportunityScenario,
  options: { includeNoMatch?: boolean } = {},
): Promise<{ requesterLabel: string; opportunities: MergeOpportunity[] }> {
  const engineRoot = path.join(process.cwd(), "goodissima-intent-engine");
  const [catalog, scenario, scoringRules] = await Promise.all([
    loadFrenchPresentationCatalog(path.join(engineRoot, "knowledge/presentation/presentation-catalog.fr.json")),
    loadDemoMergeScenario(path.join(engineRoot, `knowledge/demos/merge-${scenarioId}/scenario.fr.json`)),
    loadScoringRules(path.join(engineRoot, "knowledge/merge/scoring-rules.v1.json")),
  ]);
  const maximumScore = validateFrenchMergeDemo(scenario, catalog, scoringRules);
  const evaluated = evaluateMerge(
    scenario.requester.ciro,
    scenario.candidates.map((candidate) => candidate.ciro),
    { filterNoMatch: !options.includeNoMatch },
  );

  return {
    requesterLabel: scenario.requesterLabel,
    opportunities: evaluated.map((candidate) => {
      const fixture = scenario.candidates[candidate.candidateIndex];
      const scores = {
        relationship: candidate.relationshipScore,
        role: candidate.roleScore,
        trust: candidate.trustScore,
        family: candidate.familyScore,
      };
      return {
        id: `${scenarioId}-${candidate.candidateIndex}`,
        label: catalog.labels[fixture.presentationId],
        status: candidate.status,
        statusLabel: catalog.labels[candidate.status],
        relationalScore: Math.round((candidate.totalScore / maximumScore) * 100),
        explanations: reasonDimensions.map((dimension) => {
          const matched = scores[dimension] > 0;
          return `${matched ? "✓" : "✗"} ${catalog.reasons[dimension][matched ? "matched" : "unmatched"]}`;
        }),
        scoreBreakdown: {
          relationshipScore: candidate.relationshipScore,
          roleScore: candidate.roleScore,
          trustScore: candidate.trustScore,
          familyScore: candidate.familyScore,
          totalScore: candidate.totalScore,
        },
        ciro: fixture.ciro,
      };
    }),
  };
}
