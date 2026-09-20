import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { opportunitySequences, opportunitySteps } from "../lib/boussole-opportunities.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { validateGlossaryReferences } from "../lib/boussole/glossary.ts";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("uses three focused Opportunity micro-journeys", () => {
  assert.deepEqual(opportunitySequences.map((item) => item.id), ["discover-opportunities", "filter-opportunities", "read-opportunity"]);
  assert.equal(opportunitySteps.length, 9);
  assert.equal(getCompassContext("/opportunities")?.steps, opportunitySteps);
  for (const step of opportunitySteps) { assert.ok(step.targetId); assert.ok(step.animation?.narration); assert.equal(step.animation?.tryNow, true); }
});
test("targets only real collection controls and rows", () => {
  const source = `${read("app/(connected)/opportunities/page.tsx")}\n${read("components/OpportunityCollection.tsx")}`;
  for (const targetId of new Set(opportunitySteps.map((step) => step.targetId))) assert.ok(source.includes(targetId!), `missing Opportunity target ${targetId}`);
  for (const removed of ["opportunity-card-public-link", "opportunity-card-case-count", "opportunity-matching-status", "opportunity-admission"]) assert.ok(!opportunitySteps.some((step) => step.targetId === removed));
});
test("uses the first real visible row as the Boussole example", () => {
  const component = read("components/OpportunityCollection.tsx");
  assert.match(component, /index === 0 \? "opportunity-card"/);
  assert.match(component, /index === 0 \? "opportunity-card-title"/);
});
test("keeps guidance explanatory and glossary-backed", () => {
  assert.deepEqual(validateGlossaryReferences(opportunitySteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
  assert.doesNotMatch(read("lib/boussole-opportunities.ts"), /fetch\(|prisma\.|\.click\(\)/);
});
