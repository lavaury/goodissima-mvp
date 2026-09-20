import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";

const now = new Date("2026-09-18T10:00:00.000Z");
const rsvp = loadTestModule("lib/governed-meeting-rsvp.ts", {
  "@/lib/governed-journey-consent": {
    hasCurrentJourneyAccess: (invitation: any) => invitation.status === "ACTIVE"
      && !invitation.revokedAt
      && invitation.accessTokenExpiresAt > now
      && invitation.consent?.status === "ACCEPTED",
  },
});

function fixture(overrides: Record<string, any> = {}) {
  const participant = {
    id: "participant-new",
    governedJourneyInvitationId: "invite-new",
    status: "AUTHORIZED",
    rsvp: { id: "rsvp-new", status: "PENDING", version: 0, meetingRevision: 2, decidedByUserId: null, decidedByInvitationId: null },
    governedJourneyInvitation: {
      id: "invite-new", inviteeUserId: null, status: "ACTIVE", revokedAt: null,
      accessTokenExpiresAt: new Date("2026-09-19T10:00:00.000Z"), ownerId: "owner-1",
      relationTemplateId: "journey-1", consent: { status: "ACCEPTED" },
    },
    communicationSession: {
      ownerId: "owner-1", relationTemplateId: "journey-1", relationCaseId: null,
      status: "REQUESTED", expiresAt: new Date("2026-09-19T10:00:00.000Z"), rsvpRevision: 2,
    },
    ...overrides,
  };
  let saved = { ...participant.rsvp };
  const events: any[] = [];
  const tx = {
    governedMeetingParticipant: { findUnique: async () => participant },
    governedMeetingRsvp: {
      updateMany: async ({ data }: any) => { saved = { ...saved, ...data, version: saved.version + 1 }; return { count: 1 }; },
      findUnique: async () => saved,
      findUniqueOrThrow: async () => saved,
    },
    governedMeetingRsvpEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
  };
  return { participant, tx, events, saved: () => saved };
}

async function decide(setup: ReturnType<typeof fixture>, actor: any, decision: "ACCEPTED" | "DECLINED" = "ACCEPTED") {
  return rsvp.decideMeetingRsvpInTransaction(setup.tx, {
    meetingParticipantId: setup.participant.id,
    invitationId: "invite-new",
    actor,
    decision,
    now,
  });
}

test("authenticated invitation accepts only its linked Goodissima user", async () => {
  const good = fixture({ governedJourneyInvitation: { ...fixture().participant.governedJourneyInvitation, inviteeUserId: "user-1" } });
  await decide(good, { kind: "AUTHENTICATED_USER", userId: "user-1" });
  assert.equal(good.saved().status, "ACCEPTED");
  await assert.rejects(() => decide(fixture({ governedJourneyInvitation: good.participant.governedJourneyInvitation }), { kind: "AUTHENTICATED_USER", userId: "user-2" }), /indisponible/);
  await assert.rejects(() => decide(fixture({ governedJourneyInvitation: good.participant.governedJourneyInvitation }), { kind: "INVITATION_GUEST", invitationId: "invite-new" }), /indisponible/);
});

test("external guest accepts or declines through the exact invitation capability, despite another session", async () => {
  const accepted = fixture();
  await decide(accepted, { kind: "INVITATION_GUEST", invitationId: "invite-new" });
  assert.equal(accepted.saved().status, "ACCEPTED");
  assert.equal(accepted.saved().decidedByUserId, null);
  assert.equal(accepted.saved().decidedByInvitationId, "invite-new");
  assert.equal(accepted.events.length, 1);
  assert.equal(accepted.events[0].actorUserId, null);
  assert.equal(accepted.events[0].actorInvitationId, "invite-new");
  const declined = fixture();
  await decide(declined, { kind: "INVITATION_GUEST", invitationId: "invite-new" }, "DECLINED");
  assert.equal(declined.saved().status, "DECLINED");
  assert.equal(declined.saved().decidedByInvitationId, "invite-new");
  assert.equal(declined.events[0].actorInvitationId, "invite-new");
  assert.equal(declined.events.length, 1);
});

test("reinvite never lets the old capability or another invitation act on the new RSVP", async () => {
  for (const invitationId of ["invite-old-revoked", "invite-other"])
    await assert.rejects(() => decide(fixture(), { kind: "INVITATION_GUEST", invitationId }), /indisponible/);
  const current = fixture();
  await decide(current, { kind: "INVITATION_GUEST", invitationId: "invite-new" });
  assert.equal(current.saved().status, "ACCEPTED");
});

test("guest RSVP preserves consent, authorization, revision, lifecycle and scope guards", async () => {
  const base = fixture().participant;
  const denied = [
    { status: "REMOVED" },
    { governedJourneyInvitationId: "invite-old" },
    { rsvp: { ...base.rsvp, meetingRevision: 1 } },
    { governedJourneyInvitation: { ...base.governedJourneyInvitation, consent: { status: "PENDING" } } },
    { governedJourneyInvitation: { ...base.governedJourneyInvitation, status: "REVOKED", revokedAt: now } },
    { governedJourneyInvitation: { ...base.governedJourneyInvitation, accessTokenExpiresAt: new Date("2026-09-17T10:00:00.000Z") } },
    { communicationSession: { ...base.communicationSession, status: "CANCELLED" } },
    { communicationSession: { ...base.communicationSession, status: "COMPLETED" } },
    { communicationSession: { ...base.communicationSession, expiresAt: new Date("2026-09-17T10:00:00.000Z") } },
    { communicationSession: { ...base.communicationSession, ownerId: "owner-2" } },
    { communicationSession: { ...base.communicationSession, relationTemplateId: "journey-2" } },
    { communicationSession: { ...base.communicationSession, relationCaseId: "case-cross-scope" } },
  ];
  for (const override of denied)
    await assert.rejects(() => decide(fixture(override), { kind: "INVITATION_GUEST", invitationId: "invite-new" }), /indisponible|nouvelle réponse/);
});

test("double guest ACCEPT and DECLINE are idempotent and append no duplicate event", async () => {
  for (const decision of ["ACCEPTED", "DECLINED"] as const) {
    const setup = fixture({ rsvp: { id: "rsvp-new", status: decision, version: 1, meetingRevision: 2, decidedByUserId: null, decidedByInvitationId: "invite-new" } });
    const result = await decide(setup, { kind: "INVITATION_GUEST", invitationId: "invite-new" }, decision);
    assert.equal(result.changed, false);
    assert.equal(setup.events.length, 0);
  }
});

test("server action resolves a live token capability and never trusts a client invitation id", () => {
  const source = readFileSync(new URL("../lib/governed-meeting-rsvp-actions.ts", import.meta.url), "utf8");
  assert.match(source, /accessTokenHash: hashJourneyInvitationToken\(token\)/);
  assert.match(source, /status: "ACTIVE"/);
  assert.match(source, /revokedAt: null/);
  assert.match(source, /accessTokenExpiresAt: \{ gt: new Date\(\) \}/);
  assert.doesNotMatch(source, /formData\.get\("invitationId"\)/);
  assert.doesNotMatch(source, /getCurrentPrismaUser/);
});
