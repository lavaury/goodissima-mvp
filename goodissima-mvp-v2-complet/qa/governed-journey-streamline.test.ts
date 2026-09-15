import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { equivalentJourneyText } from "../lib/governed-journey-ux.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("masque un contexte identique ou équivalent et conserve un contexte distinct", () => {
  assert.equal(equivalentJourneyText("Organiser le voyage", "Organiser le voyage"), true);
  assert.equal(equivalentJourneyText("Contexte : organiser le voyage", "Organiser le voyage"), true);
  assert.equal(equivalentJourneyText("Budget validé par le comité", "Organiser le voyage"), false);
});

test("allège la lecture normale sans modifier les actions serveur", () => {
  const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  for (const label of ["Les personnes", "Le travail", "Documents", "Réunions et échanges", "Les décisions", "Fonctionnement et garanties", "Inviter", "Options avancées", "Marquer comme reçu", "Préparer une décision"]) assert.ok(page.includes(label), label);
  assert.match(page, /showInitialNeed \? <section/);
  assert.match(page, /action=\{prepareParticipantInvitationAction\}/);
  assert.match(page, /action=\{declareDocumentReceptionAction\}/);
  assert.match(page, /action=\{prepareGovernanceReviewAction\}/);
  assert.doesNotMatch(page, /Retour à la gouvernance|Préparer une revue de gouvernance|Aucune revue de gouvernance|Préparer sans lancer/);
});

test("réinitialise la Boussole lors du passage entre Piloter et Explorer", () => {
  const boussole = read("components/ContextualBoussole.tsx");
  assert.match(boussole, /contextSurfaceKey = `\$\{pathname\}\?\$\{search\}`/);
  assert.match(boussole, /\[context\?\.id, contextSurfaceKey, runtimeContext\.pageState\]/);
  assert.match(boussole, /"Découvrir cet espace"/);
});
