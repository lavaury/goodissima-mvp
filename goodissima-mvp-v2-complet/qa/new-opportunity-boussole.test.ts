import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getCompassContext } from "../lib/boussole-context.ts";
import { newOpportunitySequences, newOpportunitySteps } from "../lib/boussole-new-opportunity.ts";
import { getBoussoleJourneyVersion } from "../lib/boussole/registry.ts";

test("the new opportunity guide follows the real human-validation flow", () => {
  assert.equal(newOpportunitySequences.length, 1); assert.equal(newOpportunitySteps.length, 4);
  assert.equal(getCompassContext("/opportunities/new")?.id, "new-opportunity");
  assert.equal(getBoussoleJourneyVersion("create-opportunity-draft"), 2);
  const source = readFileSync(new URL("../components/OpportunityDraftCreator.tsx", import.meta.url), "utf8");
  for (const step of newOpportunitySteps) assert.ok(source.includes(step.targetId!), `missing ${step.targetId}`);
});

test("Boussole explains without interpreting, choosing or creating", () => {
  const source = readFileSync(new URL("../components/ContextualBoussole.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /understand\(\)|createDraft\(\)|\.click\(\)/);
  assert.match(newOpportunitySteps[1].body, /ne crée rien/);
  assert.match(newOpportunitySteps[3].body, /ne déclenche jamais/);
});
