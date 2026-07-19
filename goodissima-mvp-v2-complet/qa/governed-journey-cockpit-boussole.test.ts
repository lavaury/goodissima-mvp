import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { governedJourneySequences, governedJourneySteps } from "../lib/boussole-governed-journey.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { validateGlossaryReferences } from "../lib/boussole/glossary.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cockpit = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");
const boussole = read("components/ContextualBoussole.tsx");

test("provides six contextual micro-journeys for the real cockpit", () => {
  assert.equal(governedJourneySequences.length, 6);
  assert.equal(getCompassContext("/gouvernance/parcours/real-id/pilotage")?.steps, governedJourneySteps);
  assert.deepEqual(governedJourneySequences.map((item) => item.title), [
    "Découvrir ce parcours gouverné", "Voir les interventions humaines", "Participants, invitations et accès",
    "Documents et premières actions", "Communications gouvernées", "Revue de gouvernance",
  ]);
});

test("resolves every target against the real cockpit", () => {
  const renderedComponents = `${cockpit}\n${read("components/GovernedJourneyGuestAccessPanel.tsx")}\n${read("components/RelationLiveKitMediaRoom.tsx")}`;
  for (const target of new Set(governedJourneySteps.map((step) => step.targetId))) {
    assert.ok(target && renderedComponents.includes(target), `missing cockpit target ${target}`);
  }
});

test("uses deterministic states for pending, empty, prepared and received objects", () => {
  assert.match(cockpit, /humanInterventions\.length > 0 \? "pending" : "empty"/);
  assert.match(cockpit, /invitation \? "invitation-prepared" : "expected"/);
  assert.match(cockpit, /reception \? "received" : "pending"/);
  assert.match(cockpit, /data-boussole-state=\{session\.status\}/);
  assert.ok(governedJourneySteps.some((step) => step.targetStates?.includes("empty")));
  assert.ok(governedJourneySteps.some((step) => step.targetStates?.includes("received")));
});

test("targets the first real matching object and safely skips an absent dynamic target", () => {
  assert.match(boussole, /Array\.from\(document\.querySelectorAll/);
  assert.match(boussole, /candidates\.find/);
  assert.match(boussole, /resolveNextTargetInSequence/);
  assert.doesNotMatch(boussole, /\.click\(\)/);
});

test("prioritizes pending human interventions after the first opening", () => {
  assert.match(boussole, /governedJourneyVisitedKey/);
  assert.match(boussole, /alreadyVisited && pendingInterventions \? "human-interventions" : "discover-governed-journey"/);
  assert.match(boussole, /Découvrir ce parcours gouverné/);
});

test("keeps the guide explanatory, glossary-backed and business-action free", () => {
  assert.deepEqual(validateGlossaryReferences(governedJourneySteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
  const guide = read("lib/boussole-governed-journey.ts");
  assert.doesNotMatch(guide, /fetch\(|prisma\.|Action\(|email|token/i);
  assert.match(guide, /ne (?:modifie|change|lance|copie|remplit)/i);
});

test("explains personal guest links, prepared meetings and explicit media controls", () => {
  const guide = read("lib/boussole-governed-journey.ts");
  const access = read("components/GovernedJourneyGuestAccessPanel.tsx");
  const media = read("components/RelationLiveKitMediaRoom.tsx");
  assert.match(guide, /Chaque participant externe reçoit un lien personnel différent/);
  assert.match(guide, /Préparer organise la réunion sans la démarrer/);
  assert.match(guide, /microphone, sa caméra ou le partage d’écran/);
  assert.match(access, /Chaque participant reçoit son propre lien personnel/);
  assert.match(media, /governed-journey-media-room/);
  assert.match(media, /governed-journey-media-controls/);
  assert.match(media, /governed-journey-meeting-participants/);
});

test("does not add or alter cockpit business actions", () => {
  assert.doesNotMatch(guideFiles(), /action=|prisma|fetch\(/i);
  assert.match(cockpit, /action=\{prepareParticipantInvitationAction\}/);
  assert.match(cockpit, /action=\{declareDocumentReceptionAction\}/);
});

function guideFiles() {
  return `${read("lib/boussole-governed-journey.ts")}\n${read("lib/boussole-context.ts")}`;
}
