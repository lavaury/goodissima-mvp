import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";

const service = loadTestModule("lib/governed-journey-guest-access.ts", {
  "@/lib/governed-journey-invitations": {
    createJourneyInvitationToken: () => "new-raw-token",
    hashJourneyInvitationToken: (token: string) => `hash:${token}`,
  },
});
const now = new Date("2026-09-18T12:00:00.000Z");

function transaction(invitationOverrides: Record<string, unknown> = {}) {
  const invitation = {
    id: "invite-current", ownerId: "owner-1", inviteeUserId: null, status: "ACTIVE", revokedAt: null,
    accessTokenExpiresAt: new Date("2026-09-20T12:00:00.000Z"), role: "OTHER",
    consent: { id: "consent-1", status: "ACCEPTED", version: 1 },
    ...invitationOverrides,
  };
  const calls: Array<[string, any]> = [];
  const tx = {
    governedJourneyInvitation: {
      findFirst: async ({ where }: any) => where.id === invitation.id && where.ownerId === invitation.ownerId && (where.inviteeUserId === undefined || where.inviteeUserId === invitation.inviteeUserId) ? invitation : null,
      updateMany: async (args: any) => { calls.push(["invitation", args]); return { count: 1 }; },
    },
    governedMeetingParticipant: { updateMany: async (args: any) => { calls.push(["meeting", args]); return { count: 1 }; } },
    governedJourneyExpectedRoleAssignment: { updateMany: async (args: any) => { calls.push(["role", args]); return { count: 1 }; } },
    governedJourneyConsentEvent: { create: async (args: any) => { calls.push(["event", args]); return args; } },
  };
  return { invitation, tx, calls };
}

test("rotation keeps the same guest capability graph and replaces only the hashed secret and expiry", async () => {
  const setup = transaction();
  const result = await service.rotateExternalGuestAccess(setup.tx, { invitationId: setup.invitation.id, ownerId: "owner-1", now, expiresAt: new Date("2026-09-25T12:00:00.000Z") });
  assert.equal(result.invitationId, "invite-current");
  assert.ok(result.token);
  assert.equal(setup.calls.length, 1);
  const update = setup.calls[0][1];
  assert.equal(update.where.id, "invite-current");
  assert.notEqual(update.data.accessTokenHash, result.token);
  assert.deepEqual(Object.keys(update.data).sort(), ["accessTokenExpiresAt", "accessTokenHash"]);
});

test("rotation is restricted to accepted, current, external invitations", async () => {
  for (const override of [
    { inviteeUserId: "user-1" },
    { status: "REVOKED", revokedAt: now },
    { accessTokenExpiresAt: new Date("2026-09-17T12:00:00.000Z") },
    { consent: { id: "consent-1", status: "PENDING", version: 0 } },
  ]) {
    const setup = transaction(override);
    assert.equal(await service.rotateExternalGuestAccess(setup.tx, { invitationId: setup.invitation.id, ownerId: "owner-1", now, expiresAt: new Date("2026-09-25T12:00:00.000Z") }), null);
    assert.equal(setup.calls.length, 0);
  }
});

test("revocation closes current derived capabilities and preserves every historical row", async () => {
  const setup = transaction();
  assert.equal(await service.revokeGovernedJourneyInvitationAccess(setup.tx, { invitationId: setup.invitation.id, ownerId: "owner-1", now }), true);
  assert.deepEqual(setup.calls.map(([kind]) => kind), ["invitation", "meeting", "role", "event"]);
  assert.deepEqual(setup.calls[1][1].data, { status: "REMOVED", removedAt: now });
  assert.deepEqual(setup.calls[2][1].data, { revokedAt: now, revokedByUserId: "owner-1" });
  const source = readFileSync(new URL("../lib/governed-journey-guest-access.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.delete(?:Many)?\(/);
  assert.doesNotMatch(source, /governedMeetingRsvp\.(?:update|delete)/);
  assert.doesNotMatch(source, /governedJourneyConsent\.(?:update|delete)/);
});

test("cockpit exposes management only for active projected external guests and refreshes live state", () => {
  const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
  const controls = readFileSync(new URL("../components/GovernedJourneyActiveGuestAccessActions.tsx", import.meta.url), "utf8");
  const refresh = readFileSync(new URL("../components/GovernedInvitationStatusRefresh.tsx", import.meta.url), "utf8");
  assert.match(page, /!person\.identityVerified && person\.invitationId/);
  assert.match(controls, /Renouveler le lien personnel de/);
  assert.match(controls, /Révoquer l’accès de/);
  assert.match(refresh, /window\.addEventListener\("focus"/);
  assert.match(refresh, /document\.addEventListener\("visibilitychange"/);
  assert.match(refresh, /pendingCount > 0 \? window\.setInterval/);
});

test("reinvitation creation does not reactivate revoked invitations", () => {
  const creation = readFileSync(new URL("../app/api/gouvernance/invitations/route.ts", import.meta.url), "utf8");
  assert.match(creation, /status: \{ in: \["PREPARED", "ACTIVE"\] \}/);
  assert.match(creation, /governedJourneyInvitation\.create/);
  assert.doesNotMatch(creation, /status: "REVOKED"[\s\S]{0,200}governedJourneyInvitation\.update/);
});
