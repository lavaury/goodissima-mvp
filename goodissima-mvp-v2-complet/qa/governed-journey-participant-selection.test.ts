import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
const panel = read("components/GovernedJourneyAddParticipantPanel.tsx");
const actions = read("lib/governance-journey-actions.ts");

test("participant addition exposes directory and personal external invitation", () => {
  assert.match(panel, /Personne déjà dans Goodissima/);
  assert.match(panel, /Personne extérieure à Goodissima/);
  assert.match(panel, /Créer une invitation/);
  assert.match(panel, /Aucun email ou SMS n’est obligatoire/);
  assert.match(panel, /ni public, ni collectif/);
  assert.doesNotMatch(panel, /type="email"/);
});

test("role selection targets the participant panel and preserves its business context", () => {
  const roleSection = page.match(/<section id="roles-to-fill"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(roleSection, /participantRole=/);
  assert.match(roleSection, /#add-participant/);
  assert.doesNotMatch(roleSection, /#work|Le travail/);
  assert.match(panel, /initialParticipantRole/);
  assert.match(panel, /Rôle à pourvoir/);
});

test("contextual opening is keyboard and mobile safe", () => {
  assert.match(panel, /panelRef\.current\.open = true/);
  assert.match(panel, /scrollIntoView/);
  assert.match(panel, /summaryRef\.current\?\.focus/);
  assert.match(panel, /focus-visible:ring-2/);
  assert.match(panel, /min-h-11/);
  assert.match(panel, /flex-col[\s\S]*sm:flex-row/);
});

test("business role labels survive AI proposal validation", () => {
  assert.match(actions, /participantActorsFromLines/);
  assert.match(actions, /lastIndexOf\(" - "\)/);
  assert.match(actions, /actors: participantActors/);
  assert.match(page, /participant\.role \|\| "Participant attendu"/);
  assert.match(page, /Aucune personne associée/);
});

test("participant UX does not mutate consent or meeting RSVP semantics", () => {
  assert.doesNotMatch(panel, /governedJourneyConsent|governedMeetingRsvp|MeetingRsvpStatus/);
  assert.doesNotMatch(actions, /governedMeetingRsvp/);
});
