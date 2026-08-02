import assert from "node:assert/strict";
import test from "node:test";
import { canViewHistoricalElement, hasCurrentPermission, hasPermissionAt, resolveResidualAccess, roleMay } from "../lib/governed-memory/permissions.ts";
import { validateAccessGrant } from "../lib/governed-memory/validation.ts";
import type { GovernedMemoryAccessGrant, GovernedMemoryScope } from "../lib/governed-memory/types.ts";

const scope = { type: "RELATION_CASE", relationCaseId: "case-a" } as GovernedMemoryScope;
function grant(overrides: Partial<GovernedMemoryAccessGrant> = {}): GovernedMemoryAccessGrant {
  return { id: "grant-1", scope, subjectType: "USER", subjectUserId: "user-1", subjectRepresentationId: null, resourceType: "MEMORY", resourceId: null, permission: "VIEW_MEMORY", grantedByUserId: "steward-1", grantedAt: "2026-01-01T00:00:00.000Z", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveUntil: null, revokedAt: null, revokedByUserId: null, basis: "Participation documentée", residualAccessPolicy: null, ...overrides } as GovernedMemoryAccessGrant;
}

test("role matrix keeps establishment human-governed and AI suggestion-only", () => {
  assert.equal(roleMay("MEMORY_STEWARD", "ESTABLISH_FACT"), true);
  assert.equal(roleMay("MEMORY_DELEGATE", "ESTABLISH_FACT"), true);
  assert.equal(roleMay("CONTRIBUTOR", "ESTABLISH_FACT"), false);
  assert.equal(roleMay("READER", "PROPOSE_FACT"), false);
  assert.equal(roleMay("REVOKED_PARTICIPANT", "VIEW_MEMORY"), false);
  assert.equal(roleMay("SYSTEM", "ESTABLISH_FACT"), false);
  assert.equal(roleMay("AI_ASSISTANT", "VALIDATE_SYNTHESIS"), false);
});

test("grant validation requires an explicit compatible subject and basis", () => {
  assert.equal(validateAccessGrant(grant()).ok, true);
  assert.equal(validateAccessGrant(grant({ subjectRepresentationId: "rep-1" as never })).ok, false);
  assert.equal(validateAccessGrant(grant({ basis: "" })).ok, false);
});

test("historical access is not a current permission after revocation", () => {
  const revoked = grant({ revokedAt: "2026-03-01T00:00:00.000Z", revokedByUserId: "steward-1" as never });
  assert.equal(hasPermissionAt([revoked], "VIEW_MEMORY", "2026-02-01T00:00:00.000Z"), true);
  assert.equal(hasCurrentPermission([revoked], "VIEW_MEMORY", "2026-04-01T00:00:00.000Z"), false);
});

test("current rights filter every historical answer", () => {
  const historical = grant({ revokedAt: "2026-03-01T00:00:00.000Z", revokedByUserId: "steward-1" as never });
  assert.equal(canViewHistoricalElement({ requesterUserId: "user-1" as never, currentGrants: [], historicalGrants: [historical], visibility: { kind: "CASE_PARTICIPANTS" }, at: "2026-02-01T00:00:00.000Z", now: "2026-04-01T00:00:00.000Z" }), false);
});

test("a role never widens a restricted source implicitly", () => {
  const current = grant();
  assert.equal(canViewHistoricalElement({ requesterUserId: "user-1" as never, currentGrants: [current], historicalGrants: [current], visibility: { kind: "SPECIFIC_SUBJECTS", subjectUserIds: ["user-2" as never] }, at: "2026-02-01T00:00:00.000Z", now: "2026-02-01T00:00:00.000Z" }), false);
});

test("residual access is explicit, limited and dated", () => {
  const residual = grant({ revokedAt: "2026-03-01T00:00:00.000Z", revokedByUserId: "steward-1" as never, residualAccessPolicy: { permissions: ["VIEW_MEMORY"], effectiveUntil: "2026-04-01T00:00:00.000Z", basis: "Clôture contradictoire" } });
  assert.deepEqual(resolveResidualAccess(residual, "2026-03-15T00:00:00.000Z"), ["VIEW_MEMORY"]);
  assert.deepEqual(resolveResidualAccess(residual, "2026-05-01T00:00:00.000Z"), []);
});
