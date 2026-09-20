import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dossierSequences, dossierSteps } from "../lib/boussole-dossiers.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { validateGlossaryReferences } from "../lib/boussole/glossary.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const rendered = ["components/RelationCaseWorkspace.tsx", "components/DossierWorkspaceTabs.tsx", "components/ChatBox.tsx", "components/DocumentUpload.tsx", "components/RelationLiveKitMediaRoom.tsx", "components/MatchingOptInPanel.tsx", "components/MatchingPanel.tsx", "components/CandidateAccessControls.tsx"].map(read).join("\n");

test("provides five micro-journeys for the real secured dossier", () => {
  assert.equal(dossierSequences.length, 5);
  assert.equal(getCompassContext("/cases/real-case")?.steps, dossierSteps);
  assert.deepEqual(dossierSequences.map((item) => item.title), ["Comprendre ce dossier sécurisé", "Utiliser la conversation sécurisée", "Partager des documents", "Appels et communications sécurisés", "Accès et matching du dossier"]);
});

test("targets every real conversation, document and media zone", () => {
  for (const target of new Set(dossierSteps.map((step) => step.targetId))) assert.ok(target && rendered.includes(target), `missing dossier target ${target}`);
});

test("keeps message sending, file selection and room joining explicitly human", () => {
  const text = dossierSteps.map((step) => step.body).join("\n");
  assert.match(text, /La dictée remplit l’éditeur : elle n’envoie rien/);
  assert.match(text, /Seul votre clic sur Envoyer/);
  assert.match(text, /ne téléverse rien/);
  assert.match(text, /Montrer la zone ne clique pas/);
  assert.doesNotMatch(read("lib/boussole-dossiers.ts"), /fetch\(|prisma\.|\.click\(\)/);
});

test("reuses only global glossary terms", () => {
  assert.deepEqual(validateGlossaryReferences(dossierSteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
});

test("reveals the tab containing a hidden dossier target before highlighting it", () => {
  const tabs = read("components/DossierWorkspaceTabs.tsx");
  const boussole = read("components/ContextualBoussole.tsx");
  assert.match(tabs, /goodissima:reveal-dossier-target/);
  assert.match(tabs, /data-dossier-tab-content/);
  assert.match(boussole, /goodissima:reveal-dossier-target/);
  assert.match(boussole, /closest\("\[data-dossier-tab-content\]"\)/);
});
