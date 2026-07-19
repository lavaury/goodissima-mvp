import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { portfolioSequences, portfolioSteps } from "../lib/boussole-portfolios.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { validateGlossaryReferences } from "../lib/boussole/glossary.ts";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("provides the real Portfolio journeys", () => {
  assert.equal(portfolioSequences.length, 3);
  assert.equal(portfolioSteps.length, 15);
  assert.equal(getCompassContext("/gouvernance/portfolios")?.steps, portfolioSteps);
  for (const step of portfolioSteps) assert.ok(step.animation?.narration && step.animation.tryNow);
});
test("targets the first real Portfolio and its actual counters", () => {
  const page = read("app/gouvernance/portfolios/page.tsx");
  for (const target of new Set(portfolioSteps.map((step) => step.targetId))) assert.ok(page.includes(target!), `missing Portfolio target ${target}`);
  assert.match(page, /index === 0 \? "first-portfolio-card"/);
  assert.match(page, /portfolio\.totalObjectCount/);
  assert.match(page, /portfolio\.relationCaseCount/);
  assert.match(page, /portfolio\.communicationSessionCount/);
});
test("states the V1 limit without presenting future features as available", () => {
  const limit = portfolioSteps.find((step) => step.targetId === "portfolio-v1-limit")!;
  assert.match(limit.body, /évolutions futures/);
  assert.match(limit.body, /pas des fonctions disponibles/);
});
test("uses only the global glossary and never executes actions", () => {
  assert.deepEqual(validateGlossaryReferences(portfolioSteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
  assert.doesNotMatch(read("lib/boussole-portfolios.ts"), /fetch\(|\.click\(|create.*Action/);
});
