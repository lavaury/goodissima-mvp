import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newGovernedJourneySequences, newGovernedJourneySteps } from "../lib/boussole-new-governed-journey.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { validateGlossaryReferences } from "../lib/boussole/glossary.ts";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("provides the builder journeys and the local educational visit", () => {
  assert.equal(newGovernedJourneySequences.length, 6);
  assert.equal(newGovernedJourneySteps.length, 31);
  assert.equal(getCompassContext("/gouvernance/nouveau")?.steps, newGovernedJourneySteps);
  assert.equal(getCompassContext("/gouvernance/nouveau")?.pageName, "Créer un parcours gouverné");
  for (const step of newGovernedJourneySteps) assert.ok(step.targetId && step.detailedBody && step.animation?.narration && step.animation.tryNow);
});

test("targets every retained control on the real page or assistant", () => {
  const source = `${read("app/gouvernance/nouveau/page.tsx")}\n${read("app/gouvernance/nouveau/GovernanceJourneyAssistant.tsx")}\n${read("app/gouvernance/nouveau/GovernedJourneyEducationalPreview.tsx")}`;
  for (const target of new Set(newGovernedJourneySteps.map((step) => step.targetId))) assert.ok(source.includes(target!), `missing builder target ${target}`);
});

test("implements a static, closable preview with every stable target", () => {
  const preview = read("app/gouvernance/nouveau/GovernedJourneyEducationalPreview.tsx");
  assert.match(preview, /Exemple pédagogique — aucun parcours créé, aucune donnée réelle, aucune action possible\./);
  for (const target of [
    "governed-journey-educational-preview",
    "educational-journey-framework",
    "educational-journey-participants",
    "educational-journey-documents",
    "educational-journey-communications",
    "educational-journey-human-interventions",
    "educational-journey-review",
    "close-governed-journey-educational-preview",
  ]) assert.match(preview, new RegExp(target));
  assert.match(preview, /setOpen\(true\)/);
  assert.match(preview, /setOpen\(false\)/);
  assert.match(preview, /role="dialog"/);
  assert.match(preview, /aria-modal="true"/);
});

test("keeps the educational example local and out of business views", () => {
  const preview = read("app/gouvernance/nouveau/GovernedJourneyEducationalPreview.tsx");
  assert.doesNotMatch(preview, /fetch\(|prisma|server action|@\/lib\/.*actions|email|token|lien sécurisé/i);
  for (const path of ["app/dashboard/page.tsx", "app/gouvernance/page.tsx", "app/gouvernance/portfolios/page.tsx"]) {
    assert.doesNotMatch(read(path), /GovernedJourneyEducationalPreview|educational-journey-framework/);
  }
});

test("does not invent absent participant, step, review or invitation builders", () => {
  const targets = newGovernedJourneySteps.map((step) => step.targetId);
  for (const absent of ["add-governed-journey-participant", "add-governed-journey-step", "governed-journey-review-section", "governed-journey-invitations-section", "confirm-governed-journey-creation", "preview-governed-journey"]) assert.ok(!targets.includes(absent), `invented unavailable control ${absent}`);
});

test("distinguishes generation, human review and creation", () => {
  const text = newGovernedJourneySteps.map((step) => `${step.title} ${step.body}`).join("\n");
  assert.match(text, /ne lance aucun appel/);
  assert.match(text, /proposition éditable/);
  assert.match(text, /Relisez le nom, l’objectif/);
  assert.match(text, /n’invite personne, n’ouvre aucun accès et ne lance aucun workflow/);
});

test("documents the actual post-create redirect and Workspace behavior", () => {
  const actions = read("lib/governance-journey-actions.ts");
  assert.match(actions, /tx\.workspace\.upsert/);
  assert.match(actions, /redirect\(`\/gouvernance\/parcours\/\$\{formTemplate\.id\}\/pilotage`\)/);
  assert.match(actions, /automaticWorkflowExecution: false/);
  assert.match(actions, /automaticContact: false/);
});

test("uses the global glossary and keeps Boussole business-action free", () => {
  assert.deepEqual(validateGlossaryReferences(newGovernedJourneySteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
  const boussole = read("components/ContextualBoussole.tsx");
  assert.doesNotMatch(boussole, /\.click\(\)/);
  assert.match(boussole, /goodissima:open-governed-journey-preview/);
  assert.doesNotMatch(read("lib/boussole-new-governed-journey.ts"), /fetch\(|createGovernedJourneyAction|proposeGovernedJourneyAction/);
});
