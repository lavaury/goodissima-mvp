import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { projectGovernedJourneyExperience } from "../lib/governed-journey-experience.ts";

test("un parcours simple commence sans capacité artificielle", () => {
  const view = projectGovernedJourneyExperience({ humanValidated: true, totalParticipants: 0, preparedInvitations: 0, totalDocuments: 0, receivedDocuments: 0, pendingReviews: 0, interventions: [] });
  assert.deepEqual(view.actions, []);
  assert.match(view.situation, /Aucune action urgente/);
});

test("un parcours avec personnes et documents ne montre que les besoins présents", () => {
  const view = projectGovernedJourneyExperience({ humanValidated: true, totalParticipants: 3, preparedInvitations: 1, totalDocuments: 2, receivedDocuments: 1, pendingReviews: 0, interventions: [] });
  assert.deepEqual(view.actions.map((item) => item.label), ["Inviter une personne", "Examiner les documents attendus"]);
});

test("un parcours riche priorise les interventions et borne la densité", () => {
  const interventions = Array.from({ length: 6 }, (_, index) => ({ label: `Action ${index}`, detail: "Situation réelle", href: `/cases/${index}` }));
  const view = projectGovernedJourneyExperience({ humanValidated: true, totalParticipants: 4, preparedInvitations: 0, totalDocuments: 3, receivedDocuments: 0, pendingReviews: 2, interventions });
  assert.equal(view.actions.length, 5);
  assert.ok(view.actions.every((item) => item.label.startsWith("Action")));
});

test("la page expose la grammaire utilisateur et garde les surfaces legacy séparées", () => {
  const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
  for (const heading of ["Où en sommes-nous ?", "À faire maintenant", "Les personnes", "Le travail", "Les décisions", "Historique"]) assert.match(page, new RegExp(heading));
  assert.doesNotMatch(page, /Pilotage V1 · préparation read-only|Synthèse du parcours gouverné|Workspace du parcours|Metadata-first/);
  assert.match(page, /classification !== "JOURNEY"/);
  assert.match(page, /HistoricalTemplateCompatibilityView/);
  assert.match(page, /min-h-11/);
});
