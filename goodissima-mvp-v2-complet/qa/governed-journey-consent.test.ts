import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { loadTestModule } from "./helpers/load-test-module.ts";

const { decideJourneyInvitation, hasCurrentJourneyAccess, projectJourneyConsent, projectJourneyParticipationState } = loadTestModule("lib/governed-journey-consent.ts", {
  "@/lib/governed-journey-invitations": { hashJourneyInvitationToken: (token: string) => createHash("sha256").update(token).digest("hex") },
});

function fixture(options: { expired?: boolean; revoked?: boolean; revokeDuringAcceptance?: boolean; inviteeUserId?: string | null } = {}) {
  const consent: any = { id: "consent-a", invitationId: "invitation-a", status: "PENDING", decidedAt: null, decidedByUserId: null, version: 0 };
  const invitation: any = { id: "invitation-a", accessTokenHash: createHash("sha256").update("secret-token").digest("hex"), status: options.revoked ? "REVOKED" : "PREPARED", revokedAt: options.revoked ? new Date() : null, accessTokenExpiresAt: new Date(Date.now() + (options.expired ? -1000 : 60_000)), inviteeUserId: options.inviteeUserId === undefined ? "user-a" : options.inviteeUserId, role: "OBSERVER", consent };
  const events: any[] = [];
  const tx: any = {
    governedJourneyInvitation: {
      findUnique: async ({ where }: any) => where.accessTokenHash === invitation.accessTokenHash ? invitation : null,
      updateMany: async ({ where, data }: any) => {
        if (options.revokeDuringAcceptance) { invitation.status = "REVOKED"; invitation.revokedAt = new Date(); return { count: 0 }; }
        if (where.id !== invitation.id || invitation.status !== "PREPARED" || invitation.revokedAt || invitation.accessTokenExpiresAt <= where.accessTokenExpiresAt.gt) return { count: 0 };
        Object.assign(invitation, data); return { count: 1 };
      },
    },
    governedJourneyConsent: {
      updateMany: async ({ where, data }: any) => {
        if (consent.status !== where.status || consent.version !== where.version) return { count: 0 };
        Object.assign(consent, data); return { count: 1 };
      },
      findUnique: async () => consent,
    },
    governedJourneyConsentEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
  };
  return { client: { $transaction: async (run: any) => {
    const invitationBefore = { ...invitation };
    const consentBefore = { ...consent };
    try { return await run(tx); }
    catch (error) { if (!options.revokeDuringAcceptance) Object.assign(invitation, invitationBefore); Object.assign(consent, consentBefore); events.length = 0; throw error; }
  } }, invitation, consent, events };
}

test("new consent flow and legacy projection never use acceptedAt", () => {
  const valid = { status: "ACTIVE", revokedAt: null, accessTokenExpiresAt: new Date(Date.now() + 1000), acceptedAt: null } as any;
  assert.equal(projectJourneyConsent({ ...valid, consent: null }), "LEGACY_UNKNOWN");
  assert.equal(hasCurrentJourneyAccess({ ...valid, consent: null }), true);
  assert.equal(hasCurrentJourneyAccess({ ...valid, acceptedAt: new Date(), consent: { status: "PENDING" } }), false);
  assert.equal(hasCurrentJourneyAccess({ ...valid, consent: { status: "ACCEPTED" } }), true);
});

test("double accept is idempotent and emits one event", async () => {
  const f = fixture();
  const first = await decideJourneyInvitation(f.client, { token: "secret-token", userId: "user-a", decision: "ACCEPTED" });
  const second = await decideJourneyInvitation(f.client, { token: "secret-token", userId: "user-a", decision: "ACCEPTED" });
  assert.equal(first.changed, true); assert.equal(second.changed, false); assert.equal(f.events.length, 1); assert.equal(f.invitation.status, "ACTIVE");
});

test("double decline is idempotent and never opens access", async () => {
  const f = fixture();
  await decideJourneyInvitation(f.client, { token: "secret-token", userId: "user-a", decision: "DECLINED" });
  const second = await decideJourneyInvitation(f.client, { token: "secret-token", userId: "user-a", decision: "DECLINED" });
  assert.equal(second.changed, false); assert.equal(f.events.length, 1); assert.equal(f.invitation.status, "PREPARED");
});

test("accept versus decline permits one winner", async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    decideJourneyInvitation(f.client, { token: "secret-token", userId: "user-a", decision: "ACCEPTED" }),
    decideJourneyInvitation(f.client, { token: "secret-token", userId: "user-a", decision: "DECLINED" }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(f.events.length, 1);
});

test("revocation racing with acceptance rolls the decision back and opens no access", async () => {
  const f = fixture({ revokeDuringAcceptance: true });
  await assert.rejects(decideJourneyInvitation(f.client, { token: "secret-token", userId: "user-a", decision: "ACCEPTED" }), /indisponible/);
  assert.equal(f.consent.status, "PENDING");
  assert.equal(f.invitation.status, "REVOKED");
  assert.equal(f.events.length, 0);
});

for (const [name, options, userId] of [
  ["revoked", { revoked: true }, "user-a"], ["expired", { expired: true }, "user-a"], ["wrong directory user", {}, "user-b"],
] as const) test(`${name} invitation cannot be accepted`, async () => {
  const f = fixture(options);
  await assert.rejects(decideJourneyInvitation(f.client, { token: "secret-token", userId, decision: "ACCEPTED" }), /indisponible/);
  assert.equal(f.events.length, 0); assert.equal(f.invitation.status, options.revoked ? "REVOKED" : "PREPARED");
});

test("participation projection follows consent and never the presence of a user", () => {
  const base = { status: "PREPARED", revokedAt: null, inviteeUserId: null } as any;
  assert.equal(projectJourneyParticipationState({ ...base, consent: { status: "PENDING" } }), "PENDING");
  assert.equal(projectJourneyParticipationState({ ...base, consent: { status: "ACCEPTED" } }), "ACCEPTED");
  assert.equal(projectJourneyParticipationState({ ...base, consent: { status: "DECLINED" } }), "DECLINED");
  assert.equal(projectJourneyParticipationState({ ...base, status: "REVOKED", consent: { status: "PENDING" } }), "REVOKED");
  assert.equal(projectJourneyParticipationState({ ...base, consent: null }), "LEGACY_UNKNOWN");
});

for (const decision of ["ACCEPTED", "DECLINED"] as const) test(`external invitation can be ${decision.toLowerCase()} without a user`, async () => {
  const f = fixture({ inviteeUserId: null });
  const first = await decideJourneyInvitation(f.client, { token: "secret-token", userId: null, decision });
  const second = await decideJourneyInvitation(f.client, { token: "secret-token", userId: null, decision });
  assert.equal(first.changed, true); assert.equal(second.changed, false); assert.equal(f.consent.decidedByUserId, null);
  assert.equal(f.events.length, 1); assert.equal(f.events[0].actorKind, "INVITEE"); assert.equal(f.events[0].actorUserId, null);
  assert.equal(f.invitation.status, decision === "ACCEPTED" ? "ACTIVE" : "PREPARED");
});
