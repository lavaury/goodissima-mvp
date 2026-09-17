import assert from "node:assert/strict";
import test from "node:test";
import { projectExpectedRoleAssignment } from "../lib/governed-journey-role-assignments.ts";

const now = new Date("2026-09-17T12:00:00.000Z");
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
