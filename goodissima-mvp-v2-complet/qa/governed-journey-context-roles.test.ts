import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { equivalentJourneyText } from "../lib/governed-journey-ux.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("le cadre expose l'objectif, les participants prévus et le rôle courant sans répéter une description équivalente", () => {
  const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  for (const label of ["Cadre du parcours", "Objectif", "Participants prévus", "Votre rôle", "Vous êtes organisateur", "Voir les rôles et les droits"]) assert.match(page, new RegExp(label));
  assert.match(page, /equivalentJourneyText\(objective, title\)/);
  assert.equal(equivalentJourneyText("Contexte : Tournoi de bridge", "Tournoi de bridge"), true);
  assert.match(page, /sm:grid-cols-3/);
  assert.match(page, /min-h-11/);
});

test("les capabilities mémoire sont humanisées sans exposer leurs enums", () => {
  const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  for (const label of ["Peut proposer des faits", "Peut ajouter des sources", "Peut confirmer des faits", "Peut confirmer des décisions", "Peut contester des faits"]) assert.match(page, new RegExp(label));
  const frame = page.slice(page.indexOf('aria-labelledby="journey-frame-title"'), page.indexOf('data-boussole-id="governed-journey-summary"'));
  assert.doesNotMatch(frame, /MEMORY_STEWARD|VIEW_MEMORY|ESTABLISH_FACT|REGISTER_SOURCE/);
});

test("l'invitation est contextualisée et la garde serveur propriétaire précède la mutation", () => {
  const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  const action = read("lib/governance-participant-invitations-actions.ts");
  const guest = read("app/gouvernance/invitation/[token]/page.tsx");
  for (const source of [page, action, guest]) assert.match(source, /invitation concerne le parcours|Invitation au parcours/i);
  assert.match(page, /Rôle proposé/);
  assert.match(guest, /Invitation envoyée par/);
  assert.match(action, /getTemplateReadAccess\(owner, formTemplateId\)/);
});

test("Journey et réunion restent distincts sans faux consentement ni faux RSVP", () => {
  const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  const guest = read("app/gouvernance/invitation/[token]/page.tsx");
  const combined = `${page}\n${guest}`;
  assert.match(page, /Participants prévus/);
  assert.match(page, /ne vaut ni acceptation du parcours ni confirmation de présence/);
  assert.match(page, /Participants ayant accès à cette réunion/);
  assert.match(page, /ne signifie pas que la personne a confirmé sa présence/);
  assert.doesNotMatch(combined, />Accepter<|>Refuser<|>Participer<|>Décliner</);
});

test("les MODEL_GAP et la future surface 03B sont enregistrés sans schéma", () => {
  const debt = read("docs/debt-register.md");
  for (const id of ["JOURNEY-CONSENT-01", "MEETING-RSVP-01", "PARCOURS-UX-03B", "MEM-TRANSITION-MODEL-01"]) assert.match(debt, new RegExp(id));
  const audit = read("docs/parcours-ux-03a-audit.md");
  assert.match(audit, /Aucun schéma ni migration/);
});
