import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { meetingIsClosed } from "../lib/governed-journey-meetings.ts";

const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
const action = readFileSync(new URL("../lib/governed-meeting-history-actions.ts", import.meta.url), "utf8");
const now = new Date("2026-09-18T12:00:00.000Z");
const meeting = (status: string, expiresAt: Date | null = null) => ({ id: status, status, accessOpened: false, scheduledAt: null, expiresAt, createdAt: now, updatedAt: now });

test("les réunions completed, expired et cancelled restent consultables", () => {
  assert.equal(meetingIsClosed(meeting("COMPLETED"), now), true);
  assert.equal(meetingIsClosed(meeting("CANCELLED"), now), true);
  assert.equal(meetingIsClosed(meeting("REQUESTED", new Date("2026-09-18T11:00:00.000Z")), now), true);
  for (const label of ["Participants de cette réunion", "Historique RSVP", "Présence observée", "Départ non observé", "Observation technique", "Aucun contenu conservé", "Réutiliser cette réunion"]) assert.match(page, new RegExp(label));
  assert.doesNotMatch(page, /Heure réelle de fin/);
});

test("l'historique sépare RSVP, acteur, présence et médias observés", () => {
  assert.match(page, /meetingRsvpLabel\(participant\.rsvp\)/);
  assert.match(page, /decidedByUser/);
  assert.match(page, /decidedByInvitation/);
  assert.match(page, /participant\.rsvpEvents\.map/);
  assert.match(page, /presence\.joinedAt/);
  assert.match(page, /presence\.leftAt/);
  assert.match(page, /presence\.mediaUsed\.audio/);
  assert.match(page, /presence\.mediaUsed\.video/);
  assert.match(page, /presence\.mediaUsed\.screen/);
});

test("la réutilisation crée une session neuve sans état historique ni média", () => {
  assert.match(action, /communicationSession\.create/);
  assert.doesNotMatch(action, /communicationSession\.update/);
  for (const contract of ['provider: "NONE"', 'status: "PREPARED_NOT_STARTED"', "externalUrl: null", "expiresAt: null", "tokenGenerated: false", "accessOpened: false", "recordingEnabled: false", "transcriptionRequested: false"]) assert.match(action, new RegExp(contract));
  assert.match(action, /governedMeetingParticipant\.create/);
  assert.match(action, /createPendingMeetingRsvp/);
  assert.match(action, /hasCurrentJourneyAccess/);
  assert.match(action, /selectedInvitationIds/);
  assert.doesNotMatch(action, /rsvpEvents.*source|attendance.*source|copiedFrom/);
});

test("la sélection n'impose aucune limite artificielle à 1 ou 20 participants", () => {
  assert.match(action, /getAll\("invitationIds"\)/);
  assert.doesNotMatch(action, /slice\(0,\s*20\)|take:\s*20/);
  assert.match(page, /governedInvitations\.map/);
});
