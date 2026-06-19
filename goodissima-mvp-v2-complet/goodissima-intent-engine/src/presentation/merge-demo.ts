import { evaluateMerge } from "../merge/candidate-evaluator.js";
import type { EvaluatedMergeCandidate } from "../merge/candidate-evaluator.js";
import type { DemoMergeScenario, FrenchPresentationCatalog } from "./types.js";

const separator = "─────────────────────────────";

function reasonLines(candidate: EvaluatedMergeCandidate, catalog: FrenchPresentationCatalog): string[] {
  const values = [
    ["relationship", candidate.relationshipScore],
    ["role", candidate.roleScore],
    ["trust", candidate.trustScore],
    ["family", candidate.familyScore],
  ] as const;
  return values.map(([name, score]) => `   ${score > 0 ? "✓" : "✗"} ${catalog.reasons[name][score > 0 ? "matched" : "unmatched"]}`);
}

export function renderFrenchMergeDemo(scenario: DemoMergeScenario, catalog: FrenchPresentationCatalog, maximumScore: number): string {
  const evaluated = evaluateMerge(scenario.requester.ciro, scenario.candidates.map((candidate) => candidate.ciro));
  const lines = [separator, "", catalog.text.requester, scenario.requesterLabel, "", catalog.text.opportunities, ""];
  evaluated.forEach((candidate, index) => {
    const fixture = scenario.candidates[candidate.candidateIndex];
    const label = catalog.labels[fixture.presentationId];
    if (!label) throw new Error(`Missing presentation label: ${fixture.presentationId}.`);
    lines.push(`${index + 1}. ${label}`, `   ${catalog.labels[candidate.status]}`);
    if (candidate.status !== "NO_MATCH") {
      const percentage = Math.round((candidate.totalScore / maximumScore) * 100);
      lines.push(`   ${catalog.text.score} : ${percentage} %`, "", `   ${catalog.text.reasons}`, ...reasonLines(candidate, catalog));
    }
    lines.push("");
  });
  lines.push(separator);
  return lines.join("\n");
}
