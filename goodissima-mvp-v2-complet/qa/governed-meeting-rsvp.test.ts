import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";

const rsvp = loadTestModule("lib/governed-meeting-rsvp.ts", {
  "@/lib/governed-journey-consent": { hasCurrentJourneyAccess: () => true },
});

function participant(overrides: Record<string, unknown> = {}) {
  return {
    status: "AUTHORIZED",
    rsvp: { status: "ACCEPTED", meetingRevision: 2 },
    communicationSession: { rsvpRevision: 2, status: "REQUESTED", accessOpened: true, expiresAt: null },
    ...overrides,
  };
}

test("human projection never presents legacy as accepted", () => {
  assert.equal(rsvp.meetingRsvpLabel({ status: "PENDING" }), "Invitation en attente");
  assert.equal(rsvp.meetingRsvpLabel({ status: "ACCEPTED" }), "Participation acceptée");
  assert.equal(rsvp.meetingRsvpLabel({ status: "DECLINED" }), "Participation déclinée");
  assert.equal(rsvp.meetingRsvpLabel(null), "Participation historique — réponse non enregistrée");
});

test("media requires authorization, accepted current RSVP, open active meeting", () => {
  assert.equal(rsvp.hasCurrentMeetingMediaAccess(participant()), true);
  for (const denied of [
    participant({ status: "REMOVED" }),
    participant({ rsvp: { status: "PENDING", meetingRevision: 2 } }),
    participant({ rsvp: { status: "DECLINED", meetingRevision: 2 } }),
    participant({ rsvp: { status: "ACCEPTED", meetingRevision: 1 } }),
    participant({ communicationSession: { rsvpRevision: 2, status: "CANCELLED", accessOpened: false, expiresAt: null } }),
    participant({ communicationSession: { rsvpRevision: 2, status: "COMPLETED", accessOpened: false, expiresAt: null } }),
  ]) assert.equal(rsvp.hasCurrentMeetingMediaAccess(denied), false);
});

test("legacy compatibility is explicit and cannot reopen historical closed meetings", () => {
  assert.equal(rsvp.hasCurrentMeetingMediaAccess(participant({ rsvp: null })), true);
  assert.equal(rsvp.hasCurrentMeetingMediaAccess(participant({ rsvp: null, communicationSession: { rsvpRevision: 1, status: "COMPLETED", accessOpened: false, expiresAt: null } })), false);
});

test("decision transition uses optimistic concurrency and creates one event only after winning", () => {
  const source = readFileSync(new URL("../lib/governed-meeting-rsvp.ts", import.meta.url), "utf8");
  assert.match(source, /status: "PENDING",[\s\S]*version: participant\.rsvp\.version,[\s\S]*meetingRevision: session\.rsvpRevision/);
  assert.match(source, /if \(updated\.count !== 1\)/);
  assert.ok(source.lastIndexOf("governedMeetingRsvpEvent.create") > source.indexOf("if (updated.count !== 1)"));
});

test("lifecycle reset and cancellation are transactional and preserve RSVP history", () => {
  const source = readFileSync(new URL("../lib/governed-meeting-lifecycle-actions.ts", import.meta.url), "utf8");
  assert.match(source, /rsvpRevision: isSubstantial \? \{ increment: 1 \}/);
  assert.match(source, /type: "RESET_TO_PENDING"/);
  assert.match(source, /decidedByInvitationId: null/);
  assert.match(source, /type: "MEETING_CANCELLED"/);
  assert.doesNotMatch(source, /governedMeetingRsvp\.delete/);
});
