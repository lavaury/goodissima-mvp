import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getAllCompassContexts, getCompassContext } from "../lib/boussole-context.ts";
import { dashboardSequences, dashboardSteps } from "../lib/boussole-dashboard.ts";
import { simpleLinkSequences, simpleLinkSteps } from "../lib/boussole-simple-link.ts";
import { boussoleGlossary, getGlossaryTerm, searchGlossary, validateGlossaryReferences } from "../lib/boussole/glossary.ts";
import { resolveNextTargetInSequence } from "../lib/boussole/target-resolver.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("selects contextual journeys before generic navigation contexts", () => {
  assert.equal(getCompassContext("/links/simple")?.id, "simple-link");
  assert.equal(getCompassContext("/links/glink-123")?.id, "link-owner");
  assert.equal(getCompassContext("/gouvernance/pilotage")?.id, "pilotage");
  assert.equal(getCompassContext("/gouvernance")?.id, "governance");
  assert.equal(getCompassContext("/cases/case-123")?.id, "dossiers");
});

test("covers the expected internal actions in contextual journeys", () => {
  const targetIds = [
    ...getCompassContext("/links/simple")!.steps,
    ...getCompassContext("/links/glink-123")!.steps,
    ...getCompassContext("/gouvernance/pilotage")!.steps,
    ...getCompassContext("/cases/case-123")!.steps,
  ].map((step) => step.targetId);

  for (const targetId of [
    "choose-simple-link-template",
    "simple-link-fields",
    "add-simple-link-rule",
    "enable-link-matching",
    "confirm-simple-link",
    "create-simple-link",
    "copy-public-link",
    "open-public-link",
    "link-matching-status",
    "analyze-link-matching",
    "review-link-matches",
    "open-pilotage-matching-signal",
    "candidate-case-matching",
    "join-secure-communication",
  ]) {
    assert.ok(targetIds.includes(targetId), `missing contextual target ${targetId}`);
  }
});

test("keeps the floating guide state-aware and locally controlled", () => {
  const source = read("components/ContextualBoussole.tsx");
  assert.match(source, /getClientRects\(\)\.length > 0/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /data-boussole-state/);
  assert.match(source, /Étape précédente/);
  assert.match(source, /Quitter/);
  assert.match(source, /speechSynthesis/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /Recentrer/);
  assert.match(source, /Choisissez un micro-parcours, puis utilisez « Étape suivante »/);
  assert.match(source, /« Montrer la zone » repère l’élément sans déclencher d’action/);
});

test("provides the 21 Dashboard targets in five reusable micro-journeys", () => {
  assert.equal(dashboardSequences.length, 5);
  assert.equal(dashboardSteps.length, 21);
  assert.equal(new Set(dashboardSteps.map((step) => step.targetId)).size, 21);
  for (const step of dashboardSteps) {
    assert.ok(step.animation?.focus);
    assert.ok(step.animation?.narration);
    assert.ok(step.animation?.subtitles);
    assert.ok(step.animation?.duration);
    assert.equal(step.animation?.tryNow, true);
  }
});

test("provides the complete state-aware Simple link journey", () => {
  assert.equal(simpleLinkSequences.length, 7);
  assert.equal(simpleLinkSteps.length, 40);
  assert.equal(getCompassContext("/links/simple")?.steps, simpleLinkSteps);
  for (const step of simpleLinkSteps) {
    assert.ok(step.targetId);
    assert.ok(step.animation?.focus);
    assert.ok(step.animation?.narration);
    assert.ok(step.animation?.subtitles);
    assert.ok(step.animation?.duration);
    assert.ok(Array.isArray(step.glossaryTermIds));
  }
  assert.ok(simpleLinkSteps.some((step) => step.targetStates?.includes("disabled")));
  assert.ok(simpleLinkSteps.some((step) => step.targetStates?.includes("enabled")));
  assert.ok(simpleLinkSteps.some((step) => step.targetStates?.includes("created-matching")));
  const verify = simpleLinkSequences.find((sequence) => sequence.id === "verify-create")!;
  assert.equal(verify.steps[0].targetId, "simple-link-final-check-section");
  assert.ok(!verify.steps.some((step) => step.targetId === "simple-link-advanced-options"));
  assert.equal(simpleLinkSequences.at(-2)?.id, "configure-more");
  assert.equal(simpleLinkSequences.at(-1)?.id, "verify-create");
});

test("keeps missing-target fallback inside the selected sequence", () => {
  const verify = simpleLinkSequences.find((sequence) => sequence.id === "verify-create")!;
  const fallback = resolveNextTargetInSequence(verify.steps, 0, (targetId) => targetId === "confirm-simple-link" || targetId === "simple-link-advanced-options");
  assert.equal(fallback?.targetId, "confirm-simple-link");
  assert.ok(!verify.steps.some((step) => step.targetId === "simple-link-advanced-options"));
});

test("ships one global glossary on every contextual page", () => {
  assert.ok(boussoleGlossary.length >= 37);
  assert.ok(getCompassContext("/dashboard"));
  assert.ok(getCompassContext("/gouvernance"));
  assert.ok(getCompassContext("/links/simple"));
  const source = read("components/ContextualBoussole.tsx");
  for (const label of ["Guide", "Glossaire", "Mon expérience", "Découverte", "Guidé", "Autonome", "Réduire les animations", "Reprendre ma progression"]) assert.ok(source.includes(label));
  assert.match(source, /localStorage/);
  assert.match(source, /prefers-reduced-motion/);
});

test("explains and resets only local Boussole experience preferences", () => {
  const source = read("components/ContextualBoussole.tsx");
  for (const label of ["Comprendre ces réglages", "Fermer l’aide", "Longueur des explications", "Vitesse de lecture vocale", "Créer et partager un lien", "Réinitialiser mes préférences", "Confirmer la réinitialisation", "Annuler"]) assert.ok(source.includes(label));
  for (const explanation of ["Explications détaillées et parcours proposés", "Accompagnement court sur les actions importantes", "Boussole intervient principalement à votre demande", "Limite les mouvements, zooms et transitions", "Ils influencent l’ordre des guides proposés"]) assert.ok(source.includes(explanation));
  assert.match(source, /aria-expanded=\{experienceHelpOpen\}/);
  assert.match(source, /aria-controls="boussole-experience-help"/);
  assert.match(source, /setExperienceHelpOpen/);
  assert.match(source, /role="alert"/);
  assert.match(source, /removeItem\(experienceStorageKey\)/);
  assert.match(source, /startsWith\(`\$\{progressStorageKey\}:`\)/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /aria-label=\{`Information/);
  assert.doesNotMatch(source.slice(source.indexOf("function resetExperiencePreferences"), source.indexOf("function setExperienceLevel")), /fetch\(|email|notification|workflow/i);
});

test("searches labels, aliases and definitions without case or accent differences", () => {
  assert.ok(searchGlossary("matching").some((term) => term.id === "matching-relationnel"));
  assert.ok(searchGlossary("qui peut répondre").some((term) => term.id === "admission"));
  assert.ok(searchGlossary("IDENTITE").some((term) => term.id === "identite-goodissima-verifiee"));
  assert.ok(searchGlossary("pilot").some((term) => term.id === "salle-pilotage"));
});

test("keeps glossary ids, labels, related terms and Guide references coherent", () => {
  const glossaryTermIds = getAllCompassContexts().flatMap((context) => context.steps.flatMap((step) => step.glossaryTermIds ?? []));
  assert.deepEqual(validateGlossaryReferences(glossaryTermIds), []);
  assert.equal(getGlossaryTerm("admission")?.label, "Admission");
  assert.ok(getCompassContext("/links/simple")!.steps.some((step) => step.glossaryTermIds?.includes("matching-relationnel")));
});

test("offers contextual targeting or concerned pages without business actions", () => {
  const source = read("components/ContextualBoussole.tsx");
  assert.match(source, /Montrer sur cette page/);
  assert.match(source, /Voir les pages concernées/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /goodissima-boussole-highlight/);
  assert.match(source, /Aucun terme ne correspond à votre recherche/);
});

test("declares every important Boussole target on a real UI element", () => {
  const source = [
    read("app/links/simple/simple-link-builder.tsx"),
    read("app/links/[linkId]/page.tsx"),
    read("app/dashboard/page.tsx"),
    read("app/gouvernance/pilotage/page.tsx"),
    read("components/GLinkMatchingPanel.tsx"),
    read("components/LinkCard.tsx"),
    read("components/MatchingOptInPanel.tsx"),
    read("components/MatchingPanel.tsx"),
    read("components/RelationLiveKitMediaRoom.tsx"),
  ].join("\n");

  for (const targetId of [
    "choose-simple-link-template",
    "simple-link-fields",
    "add-simple-link-rule",
    "confirm-simple-link",
    "create-simple-link",
    "copy-public-link",
    "open-public-link",
    "explain-link-admission",
    "link-matching-status",
    "analyze-link-matching",
    "review-link-matches",
    "open-pilotage-matching-signal",
    "dashboard-link-matching-indicator",
    "timeline-created-link",
    "candidate-case-matching",
    "join-secure-communication",
  ]) {
    assert.ok(source.includes(targetId), `missing UI target ${targetId}`);
  }
});

test("limits AI assistance to filtered explanatory input without business execution", () => {
  const source = read("app/api/boussole/ask/route.ts");
  assert.match(source, /question\.trim|question\.replace/);
  assert.match(source, /slice\(0, 500\)/);
  assert.match(source, /sensitivePattern/);
  assert.match(source, /Tu ne déclenches et ne prétends déclencher aucune action/);
  assert.doesNotMatch(source, /RelationCase|candidateAccessToken|guestAccessToken/);
});
