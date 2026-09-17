import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { projectAssignableJourneyParticipants, projectExpectedRoleAssignment } from "../lib/governed-journey-role-assignments.ts";

const now = new Date("2026-09-17T12:00:00.000Z");
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const base = { id: "assignment", expectedRoleId: "role", assigneeUserId: null, revokedAt: null };
const invitation = { id: "invitation", displayName: "Ada", status: "PREPARED", revokedAt: null, accessTokenExpiresAt: new Date("2026-09-18T12:00:00.000Z"), consent: { status: "PENDING" } };

test("projects a missing or revoked assignment as unassigned", () => {
  assert.equal(projectExpectedRoleAssignment(undefined, now), "UNASSIGNED");
  assert.equal(projectExpectedRoleAssignment({ ...base, revokedAt: now }, now), "UNASSIGNED");
});

test("projects direct assignment without invitation or consent", () => {
  assert.equal(projectExpectedRoleAssignment({ ...base, assigneeUserId: "user" }, now), "ASSIGNED");
});

test("keeps invitation pending until explicit acceptance", () => {
  assert.equal(projectExpectedRoleAssignment({ ...base, assigneeInvitation: invitation }, now), "PENDING_INVITATION");
  assert.equal(projectExpectedRoleAssignment({ ...base, assigneeInvitation: { ...invitation, status: "ACTIVE", consent: { status: "ACCEPTED" } } }, now), "ASSIGNED");
});

test("declined, revoked and expired invitations never fill a role", () => {
  assert.equal(projectExpectedRoleAssignment({ ...base, assigneeInvitation: { ...invitation, consent: { status: "DECLINED" } } }, now), "UNASSIGNED");
  assert.equal(projectExpectedRoleAssignment({ ...base, assigneeInvitation: { ...invitation, status: "REVOKED" } }, now), "UNASSIGNED");
  assert.equal(projectExpectedRoleAssignment({ ...base, assigneeInvitation: { ...invitation, accessTokenExpiresAt: now } }, now), "UNASSIGNED");
});

test("only accepted same-owner participants are assignable and current user is not duplicated", () => {
  const candidate = { id: "accepted", ownerId: "owner", inviteeUserId: "participant", displayName: "Ada", status: "ACTIVE", revokedAt: null, accessTokenExpiresAt: new Date("2026-09-18T12:00:00.000Z"), consent: { status: "ACCEPTED" } };
  const projected = projectAssignableJourneyParticipants([
    candidate,
    { ...candidate, id: "guest", inviteeUserId: null, displayName: "Guest" },
    { ...candidate, id: "self", inviteeUserId: "owner" },
    { ...candidate, id: "other-owner", ownerId: "other" },
    { ...candidate, id: "pending", consent: { status: "PENDING" } },
    { ...candidate, id: "declined", consent: { status: "DECLINED" } },
    { ...candidate, id: "revoked", status: "REVOKED" },
    { ...candidate, id: "expired", accessTokenExpiresAt: now },
  ], { ownerId: "owner", currentUserId: "owner", now });
  assert.deepEqual(projected, [
    { invitationId: "accepted", displayName: "Ada", identified: true },
    { invitationId: "guest", displayName: "Guest", identified: false },
  ]);
});

test("participant selector keeps the initial render bounded for 1, 5, 6, 20 and 100", () => {
  for (const count of [1, 5, 6, 20, 100]) {
    const participants = Array.from({ length: count }, (_, index) => ({ ...invitation, id: `p-${index}`, ownerId: "owner", inviteeUserId: `u-${index}`, displayName: `Person ${index}`, consent: { status: "ACCEPTED" }, status: "ACTIVE" }));
    const projected = projectAssignableJourneyParticipants(participants, { ownerId: "owner", currentUserId: "self", now });
    assert.equal(projected.slice(0, 5).length, Math.min(count, 5));
    assert.equal(projected.length > 5, count > 5);
  }
});

test("existing participant assignment derives the XOR target on the server", () => {
  const actions = read("lib/governed-journey-role-assignment-actions.ts");
  const panel = read("components/GovernedJourneyAddParticipantPanel.tsx");
  assert.match(panel, /2\. Participants du parcours/);
  assert.match(panel, /Affecter à ce rôle/);
  assert.doesNotMatch(panel, /name="userId"/);
  assert.match(actions, /relationTemplateId: journey\.relationTemplateId/);
  assert.match(actions, /consent: \{ status: "ACCEPTED" \}/);
  assert.match(actions, /assigneeUserId: participant\.inviteeUserId/);
  assert.match(actions, /assigneeInvitationId: participant\.inviteeUserId \? null : participant\.id/);
  assert.doesNotMatch(actions, /governedJourneyInvitation\.create|governedJourneyConsent\.create/);
});

test("role assignments are opt-in and never inferred from Journey participation", () => {
  const invitationRoute = read("app/api/gouvernance/invitations/route.ts");
  const consent = read("lib/governed-journey-consent.ts");
  const actions = read("lib/governed-journey-role-assignment-actions.ts");
  assert.match(invitationRoute, /if \(expectedRoleId && governedJourney\) await tx\.governedJourneyExpectedRoleAssignment\.create/);
  assert.doesNotMatch(consent, /governedJourneyExpectedRoleAssignment\.create/);
  assert.doesNotMatch(consent, /expectedRoleId/);
  assert.match(actions, /assignJourneyParticipantToExpectedRoleAction/);
  assert.doesNotMatch(actions, /governedJourneyInvitation\.create|governedJourneyConsent\.create/);
});

test("generic participation labels never manufacture expected roles", () => {
  const invitationRoute = read("app/api/gouvernance/invitations/route.ts");
  assert.doesNotMatch(invitationRoute, /expectedRoleId\s*\?\?\s*(?:"Participant"|"Joueur"|"Participant attendu")/);
  assert.match(invitationRoute, /expectedRoleId = typeof body\.expectedRoleId/);
});
