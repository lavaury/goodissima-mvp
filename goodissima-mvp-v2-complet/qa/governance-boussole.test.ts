import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { governanceSequences, governanceSteps } from "../lib/boussole-governance.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { searchGlossary, validateGlossaryReferences } from "../lib/boussole/glossary.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("uses seven Governance micro-journeys backed by the main page", () => {
  assert.equal(governanceSequences.length, 7);
  assert.equal(governanceSteps.length, 42);
  assert.equal(getCompassContext("/gouvernance")?.steps, governanceSteps);
  assert.equal(getCompassContext("/gouvernance")?.pageName, "Comprendre Gouvernance");
  for (const step of governanceSteps) {
    assert.ok(step.targetId);
    assert.ok(step.detailedBody);
    assert.ok(step.animation?.narration);
    assert.ok(step.animation?.subtitles);
    assert.equal(step.animation?.tryNow, true);
  }
});

test("resolves every retained target on the real Governance page", () => {
  const page = `${read("app/gouvernance/page.tsx")}\n${read("components/PlatformNavigation.tsx")}`;
  for (const target of new Set(governanceSteps.map((step) => step.targetId))) assert.ok(page.includes(target!), `missing Governance target ${target}`);
  assert.match(page, /firstGovernedJourneyId/);
  assert.match(page, /workspace\.workspaceId === workspaces\[0\]\?\.workspaceId/);
  assert.doesNotMatch(page, /demo.*governance-first/i);
});

test("handles empty and populated Governance states without fictional content", () => {
  const targets = governanceSteps.map((step) => step.targetId);
  assert.ok(targets.includes("governance-empty-state"));
  assert.ok(targets.includes("governance-first-workspace"));
  assert.ok(targets.includes("governance-first-journey"));
  assert.ok(targets.includes("open-governed-journey"));
});

test("does not invent unavailable review, invitation or status summaries", () => {
  const targets = governanceSteps.map((step) => step.targetId);
  for (const unavailable of ["governance-pending-reviews-count", "governance-prepared-invitations-count", "governance-prepared-review", "governance-prepared-invitation", "governed-journey-next-action", "governed-journey-status", "open-workspace"]) assert.ok(!targets.includes(unavailable), `invented unavailable target ${unavailable}`);
});

test("distinguishes simple links, governed journeys and both pilotage levels", () => {
  const text = governanceSteps.map((step) => `${step.title} ${step.body}`).join("\n");
  assert.match(text, /lien simple/i);
  assert.match(text, /parcours gouverné/i);
  assert.match(text, /Salle de pilotage globale|Salle de pilotage consolide/i);
  assert.match(text, /cockpit d’un parcours/i);
  assert.match(text, /ne déclenche aucune action automatiquement/i);
});

test("uses the unique global Governance glossary", () => {
  assert.deepEqual(validateGlossaryReferences(governanceSteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
  for (const [query, id] of [["gouvernance", "gouvernance"], ["rattacher", "rattachement"], ["pilotage transversal", "pilotage-global"], ["cockpit", "cockpit-consolide"], ["invitation gouvernée", "invitation-privee"]]) assert.ok(searchGlossary(query).some((term) => term.id === id), `missing global term ${id}`);
});

test("keeps Governance guidance free of business execution", () => {
  const boussole = read("components/ContextualBoussole.tsx");
  assert.doesNotMatch(boussole, /\.click\(\)/);
  assert.match(boussole, /scrollIntoView/);
  assert.match(boussole, /goodissima-boussole-highlight/);
  assert.doesNotMatch(read("lib/boussole-governance.ts"), /fetch\(|sendEmail|createWorkspace|attach.*Action/);
});
