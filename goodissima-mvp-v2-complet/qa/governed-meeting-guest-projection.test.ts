import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { guestMeetingAvailabilityMessage, guestMeetingRsvpLabel, guestMeetingStateLabel, projectGuestMeetingState } from "../lib/governed-meeting-guest-projection.ts";

const now = new Date("2026-09-18T12:00:00.000Z");
const session = (status: "REQUESTED" | "PREPARED_NOT_STARTED" | "COMPLETED" | "CANCELLED", accessOpened: boolean, expiresAt: Date | null = new Date("2026-09-19T12:00:00.000Z")) => ({ status, accessOpened, expiresAt });

test("PREPARED accepté annonce seulement une ouverture future", () => {
  const state = projectGuestMeetingState(session("PREPARED_NOT_STARTED", false), now);
  assert.equal(state, "PREPARED");
  assert.equal(guestMeetingRsvpLabel("ACCEPTED", state), "Participation confirmée");
  assert.equal(guestMeetingAvailabilityMessage(state, "ACCEPTED"), "La salle sera disponible lorsque l’organisateur ouvrira la réunion.");
});

test("EXPIRED accepté devient un historique sans promesse d'ouverture", () => {
  const state = projectGuestMeetingState(session("REQUESTED", true, new Date("2026-09-18T11:00:00.000Z")), now);
  assert.equal(guestMeetingStateLabel(state), "Réunion expirée");
  assert.equal(guestMeetingRsvpLabel("ACCEPTED", state), "Vous aviez confirmé votre participation à cette réunion.");
  assert.equal(guestMeetingAvailabilityMessage(state, "ACCEPTED"), "Cette réunion n’est plus accessible.");
  assert.doesNotMatch(guestMeetingAvailabilityMessage(state, "ACCEPTED"), /ouvrira/);
});

test("COMPLETED accepté est consultable uniquement comme historique", () => {
  const state = projectGuestMeetingState(session("COMPLETED", false), now);
  assert.equal(guestMeetingStateLabel(state), "Réunion terminée");
  assert.match(guestMeetingRsvpLabel("ACCEPTED", state), /aviez confirmé/);
  assert.match(guestMeetingAvailabilityMessage(state, "ACCEPTED"), /historique/);
});

test("CANCELLED conserve la réponse sans la présenter comme un refus", () => {
  const state = projectGuestMeetingState(session("CANCELLED", false), now);
  assert.equal(guestMeetingStateLabel(state), "Réunion annulée");
  assert.match(guestMeetingRsvpLabel("ACCEPTED", state), /aviez confirmé/);
  assert.doesNotMatch(guestMeetingAvailabilityMessage(state, "ACCEPTED"), /décliné|refus/);
});

test("EXPIRED décliné conserve le refus historique", () => {
  const state = projectGuestMeetingState(session("REQUESTED", true, new Date("2026-09-18T11:00:00.000Z")), now);
  assert.equal(guestMeetingRsvpLabel("DECLINED", state), "Vous aviez décliné votre participation à cette réunion.");
});

test("aucun état passé ne peut afficher Rejoindre", () => {
  const page = readFileSync(new URL("../app/gouvernance/invitation/[token]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /meetingState === "OPEN" &&/);
  assert.match(page, /meetingState === "EXPIRED" && session\.expiresAt/);
  assert.match(page, /Date prévue/);
  for (const state of ["EXPIRED", "COMPLETED", "CANCELLED"] as const) assert.notEqual(projectGuestMeetingState(session(state === "EXPIRED" ? "REQUESTED" : state, true, state === "EXPIRED" ? new Date("2026-09-18T11:00:00.000Z") : null), now), "OPEN");
});
