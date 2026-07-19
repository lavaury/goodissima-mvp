import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { opportunitySequences, opportunitySteps } from "../lib/boussole-opportunities.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { searchGlossary, validateGlossaryReferences } from "../lib/boussole/glossary.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("uses seven real Opportunity micro-journeys", () => {
  assert.equal(opportunitySequences.length, 7);
  assert.equal(opportunitySteps.length, 32);
  assert.equal(getCompassContext("/opportunities")?.steps, opportunitySteps);
  assert.equal(getCompassContext("/opportunities", "view=archived")?.steps, opportunitySteps);
  for (const step of opportunitySteps) {
    assert.ok(step.targetId);
    assert.ok(step.animation?.narration);
    assert.ok(step.animation?.subtitles);
    assert.equal(step.animation?.tryNow, true);
  }
});

test("targets only Opportunity functions that really exist", () => {
  const source = `${read("app/opportunities/page.tsx")}\n${read("components/LinkCard.tsx")}`;
  for (const targetId of new Set(opportunitySteps.map((step) => step.targetId))) {
    assert.ok(source.includes(targetId!), `missing Opportunity target ${targetId}`);
  }
  for (const absentFeature of ["opportunities-search", "opportunities-filter-pending", "opportunities-filter-priority", "opportunities-filter-urgent"]) {
    assert.ok(!opportunitySteps.some((step) => step.targetId === absentFeature), `invented unavailable feature ${absentFeature}`);
  }
});

test("uses only the first real card as the Boussole example", () => {
  const page = read("app/opportunities/page.tsx");
  const card = read("components/LinkCard.tsx");
  assert.match(page, /boussoleOpportunityExample=\{index === 0\}/);
  assert.match(card, /boussoleOpportunityExample \? "opportunity-card"/);
  assert.doesNotMatch(page, /demo.*boussoleOpportunityExample/i);
});

test("adapts matching guidance to every real display state", () => {
  const matching = opportunitySequences.find((sequence) => sequence.id === "understand-opportunity-matching")!;
  const states = matching.steps.flatMap((step) => step.targetStates ?? []);
  assert.deepEqual(states, ["DISABLED", "TO_ANALYZE", "MATCHES_TO_REVIEW", "FOLLOW_UP_TO_DECIDE", "NO_RESULTS"]);
  const page = read("app/opportunities/page.tsx");
  assert.match(page, /deriveGLinkMatchingDisplayState/);
  assert.match(page, /aiEvents/);
});

test("explains Opportunity admission without changing it", () => {
  const admission = opportunitySteps.find((step) => step.targetId === "opportunity-admission")!;
  assert.match(admission.body, /Ouverte à tous/);
  assert.match(admission.body, /Réservée aux personnes vérifiées/);
  assert.match(admission.body, /sans le modifier/);
  assert.ok(admission.glossaryTermIds?.includes("admission"));
  assert.ok(admission.glossaryTermIds?.includes("identite-goodissima-verifiee"));
});

test("keeps Opportunity guidance explanatory and business-action free", () => {
  const boussole = read("components/ContextualBoussole.tsx");
  assert.match(boussole, /classList\.add\("goodissima-boussole-highlight"\)/);
  assert.match(boussole, /scrollIntoView/);
  assert.doesNotMatch(boussole, /\.click\(\)/);
  assert.doesNotMatch(boussole, /archiveAnnouncement|shareLink|clipboard\.writeText/);
});

test("keeps all Opportunity vocabulary in the global glossary", () => {
  assert.deepEqual(validateGlossaryReferences(opportunitySteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
  for (const [query, id] of [["opportunité", "opportunite"], ["prioritaire", "priorite"], ["urgente", "urgence"], ["clôturée", "cloture"], ["suite à décider", "suite-a-decider"], ["partager", "partage"]]) {
    assert.ok(searchGlossary(query).some((term) => term.id === id), `global glossary cannot find ${query}`);
  }
});
