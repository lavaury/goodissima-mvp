import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getBoussoleJourneyVersion } from "../lib/boussole/registry.ts";

const read = (path: string) => readFileSync(path, "utf8");
const panel = read("components/GovernedJourneyAddParticipantPanel.tsx");
const cockpit = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
const runtime = read("lib/governed-journey-selection.ts");
const directory = read("components/directory/DirectoryExperience.tsx");

test("cockpit fixes the current governed Journey and never offers a Journey selector", () => {
  assert.match(cockpit, /governedJourneyId=\{roleJourney\?\.id\}/);
  assert.match(cockpit, /relationTemplateId: formTemplate\.relationTemplate\.id, authorityUserId: owner\.id/);
  assert.match(panel, /journeyId: governedJourneyId/);
  assert.match(panel, /Parcours :<\/strong> \{journeyTitle\}/);
  assert.doesNotMatch(panel, /Choisir (?:un|le) Parcours|<select[^>]*journey/i);
});

test("directory mode is in-place, multi-select, confirmed and refreshes the cockpit", () => {
  assert.match(panel, /\/api\/directory\/search/);
  assert.match(panel, /actorType: "PERSON"/);
  assert.match(panel, /type=\{contextual \? "radio" : "checkbox"\}/);
  assert.match(panel, /Inviter dans ce Parcours/);
  assert.match(panel, /Confirmer les invitations/);
  assert.match(panel, /\/api\/gouvernance\/selections\/journey/);
  assert.match(panel, /source: "DIRECTORY"/);
  assert.match(panel, /router\.refresh\(\)/);
  assert.doesNotMatch(panel, /href="\/annuaire"|router\.push\("\/annuaire/);
});

test("individual outcomes expose a delivery link only for newly invited people", () => {
  for (const label of ["Invitation préparée", "Déjà invité", "Déjà participante", "Non invitable"]) assert.match(panel, new RegExp(label));
  assert.match(panel, /item\.status === "INVITED" && item\.deliveryUrl/);
  assert.match(panel, /Copier le lien/);
  assert.doesNotMatch(panel, /accessTokenHash|createJourneyInvitationToken/);
});

test("matching remains honest until a canonical person resolver exists", () => {
  assert.match(panel, /Aucun de ces résultats ne correspond actuellement à une personne Goodissima pouvant être invitée directement/);
  assert.match(panel, /Aucune identité personnelle n’est déduite automatiquement/);
  assert.match(runtime, /input\.source === "DIRECTORY" \?/);
  assert.doesNotMatch(panel, /fabricat|candidateEmail|DirectoryProfile\.create/i);
});

test("role picker preserves explicit assignment and direct invitation while standalone directory is unchanged", () => {
  assert.match(panel, /1\. Moi-même/);
  assert.match(panel, /2\. Participants du parcours/);
  assert.match(panel, /3\. Rechercher \/ inviter une personne/);
  assert.match(panel, /Invitation d’abord, consentement ensuite\. Aucun rôle n’est affecté automatiquement/);
  assert.match(panel, /assignJourneyParticipantToExpectedRoleAction/);
  assert.match(panel, /Créer une invitation/);
  assert.match(directory, /setJourneyId/);
  assert.match(directory, /Inviter dans un Parcours/);
  assert.match(directory, /Confirmer les invitations/);
});

test("Boussole targets the four real controls and revisions only the changed journey", () => {
  for (const id of ["add-journey-participants", "journey-participant-directory", "journey-participant-matching", "journey-participant-direct-invite"]) {
    assert.match(panel, new RegExp(`data-boussole-id=.*${id}`));
    assert.match(read("lib/boussole-governed-journey.ts"), new RegExp(id));
  }
  assert.equal(getBoussoleJourneyVersion("participants-access"), 3);
});
