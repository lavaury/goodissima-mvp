import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { meetingListCategory, selectPrimaryMeetings } from "../lib/governed-journey-meetings.ts";

const now = new Date("2026-09-15T12:00:00.000Z");
function meeting(id: string, overrides: Partial<{ status: string; accessOpened: boolean; scheduledAt: Date | null; expiresAt: Date | null; createdAt: Date; updatedAt: Date }> = {}) {
  return { id, status: "PREPARED_NOT_STARTED", accessOpened: false, scheduledAt: null, expiresAt: null, createdAt: new Date(`2026-09-${id === "recent" ? "14" : "10"}T10:00:00.000Z`), updatedAt: new Date(`2026-09-${id === "recent" ? "14" : "10"}T10:00:00.000Z`), ...overrides };
}

test("le cockpit retient au plus trois réunions dans l'ordre en cours, prochaine, préparation", () => {
  const current = meeting("current", { status: "REQUESTED", accessOpened: true, updatedAt: new Date("2026-09-15T11:00:00.000Z") });
  const upcoming = meeting("upcoming", { scheduledAt: new Date("2026-09-16T09:00:00.000Z") });
  const preparing = meeting("preparing", { createdAt: new Date("2026-09-15T10:00:00.000Z") });
  const recent = meeting("recent", { status: "COMPLETED" });
  assert.deepEqual(selectPrimaryMeetings([recent, preparing, upcoming, current], now).map((item) => item.id), ["current", "upcoming", "preparing"]);
  assert.ok(selectPrimaryMeetings([recent, preparing, upcoming, current], now).length <= 3);
});

test("la liste complète classe les réunions sans confondre préparation et cours", () => {
  assert.equal(meetingListCategory(meeting("preparing"), now), "En préparation");
  assert.equal(meetingListCategory(meeting("upcoming", { scheduledAt: new Date("2026-09-16T09:00:00.000Z") }), now), "À venir");
  assert.equal(meetingListCategory(meeting("done", { status: "COMPLETED" }), now), "Terminées");
});

test("participants et date sont des actions visibles sans faux RSVP", () => {
  const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
  for (const label of ["Ajouter des participants", "Les personnes sélectionnées auront accès", "Participants de cette réunion", "A accès à cette réunion", "Retirer l’accès à cette réunion", "Définir la date", "Ouvrir quand même", "Voir toutes les réunions", "En préparation", "À venir", "Terminées"]) assert.match(page, new RegExp(label));
  assert.match(page, /Invitation au parcours en attente/);
  assert.match(page, /Inviter d’abord au parcours/);
  assert.match(page, /Goodissima ne suit pas encore la réponse/);
  assert.doesNotMatch(page, /Invitation acceptée|Participation confirmée|>Accepter<|>Décliner</);
  assert.match(page, /min-h-11/);
});

test("ajout et retrait restent gardés côté serveur et verrouillés après terminaison", () => {
  const actions = readFileSync(new URL("../lib/governed-meeting-participant-actions.ts", import.meta.url), "utf8");
  assert.match(actions, /ownerId: owner\.id/);
  assert.match(actions, /session\.relationTemplateId !== form\.relationTemplateId/);
  assert.match(actions, /COMPLETED.*CANCELLED/);
  assert.match(actions, /status: "AUTHORIZED"/);
  assert.match(actions, /status: "REMOVED"/);
});
