import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { projectCompactJourneyPeople } from "../lib/governed-journey-people.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
const participantPanel = read("components/GovernedJourneyAddParticipantPanel.tsx");

test("participants and template roles are distinct and remain dense", () => {
  assert.match(page, /Participants du parcours/);
  assert.match(page, /Rôles à pourvoir/);
  assert.match(page, /Aucune personne associée/);
  assert.match(page, /peopleProjection\.visibleActive/);
  assert.match(page, /Invitation en attente/);
  assert.match(page, /Participation acceptée/);
  assert.match(page, /Voir toutes les personnes/);
  assert.match(page, /unfilledRoles\.length <= 5/);
  assert.match(participantPanel, /Choisir une personne/);
});

test("people remain compact and fully accessible across active and pending states", () => {
  for (const count of [1, 5, 6, 20, 100]) {
    const active = Array.from({ length: count }, (_, index) => `active-${index}`);
    const projection = projectCompactJourneyPeople(active, []);
    assert.equal(projection.visibleActive.length, Math.min(count, 5));
    assert.equal(projection.hasOverflow, count > 5);
    assert.deepEqual([...projection.visibleActive, ...projection.remainingActive], active);
  }

  const active = Array.from({ length: 20 }, (_, index) => `active-${index}`);
  const pending = Array.from({ length: 20 }, (_, index) => `pending-${index}`);
  const mixed = projectCompactJourneyPeople(active, pending);
  assert.equal(mixed.visibleActive.length, 5);
  assert.equal(mixed.visiblePending.length, 5);
  assert.equal(mixed.totalActive, 20);
  assert.equal(mixed.totalPending, 20);
  assert.deepEqual([...mixed.visibleActive, ...mixed.remainingActive], active);
  assert.deepEqual([...mixed.visiblePending, ...mixed.remainingPending], pending);
});

test("the global directory invitation is contextual, personal and email-free", () => {
  assert.match(page, /GovernedJourneyAddParticipantPanel/);
  assert.match(participantPanel, /Personne déjà dans Goodissima/);
  assert.match(participantPanel, /journeyObjective/);
  assert.match(participantPanel, /destiné uniquement à cette invitation/);
  assert.match(participantPanel, /Copier le lien personnel/);
  assert.doesNotMatch(participantPanel, /type="email"|partager ce lien à tout le monde/i);
});

test("current actions group unfilled roles and exclude consolidation internals", () => {
  assert.match(page, /rôles restent à pourvoir/);
  assert.match(page, /interventions: \[\.\.\.meetingActions, \.\.\.rolesAction\]/);
  assert.match(page, /totalParticipants: 0,\s+preparedInvitations: 0,/);
  assert.doesNotMatch(page.match(/const experience = projectGovernedJourneyExperience\([\s\S]*?\n  \}\);/)?.[0] ?? "", /consolidation|signal\.source|Préparer manuellement/);
});

test("workspace internals and historical preparation require explicit technical mode", () => {
  assert.match(page, /technical=1#technical-workspace/);
  assert.match(page, /searchParams\.technical === "1" && consolidation\?\.workspace/);
  assert.match(page, /searchParams\.technical === "1" \? <details/);
  assert.doesNotMatch(page, />Voir le travail rattaché en détail</);
});

test("meeting cards expose user guarantees without infrastructure vocabulary", () => {
  const meetingCard = page.match(/primaryMeetings\.map[\s\S]*?Voir toutes les réunions/)?.[0] ?? "";
  assert.match(meetingCard, /Enregistrement/);
  assert.match(meetingCard, /Transcription/);
  assert.match(meetingCard, /Accès/);
  assert.doesNotMatch(meetingCard, />Provider|>Token|>Adapter|>Prisma/);
});

test("normal controls remain keyboard and mobile friendly without consent or RSVP fiction", () => {
  assert.match(page, /min-h-11/);
  assert.match(participantPanel, /min-w-0/);
  assert.match(participantPanel, /role="status"/);
  assert.doesNotMatch(page, />Acceptée<|>Refusée<|Participation confirmée|>Décline</);
});
