import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../prisma/migrations/20260917163500_add_governed_journey_expected_role_assignment/migration.sql", import.meta.url),
  "utf8",
);

test("expected Journey roles target exactly one real assignee", () => {
  assert.match(schema, /model GovernedJourneyExpectedRoleAssignment/);
  assert.match(schema, /expectedRoleId\s+String/);
  assert.match(schema, /assigneeUserId\s+String\?/);
  assert.match(schema, /assigneeInvitationId\s+String\?/);
  assert.match(migration, /GovernedJourneyExpectedRoleAssignment_assignee_xor_check/);
  assert.match(migration, /CHECK \(\("assigneeUserId" IS NOT NULL\) <> \("assigneeInvitationId" IS NOT NULL\)\)/);
});

test("same-Journey membership is enforced by composite foreign keys", () => {
  assert.match(schema, /fields: \[governedJourneyId, relationTemplateId\], references: \[id, relationTemplateId\]/);
  assert.match(schema, /fields: \[assigneeInvitationId, relationTemplateId\], references: \[id, relationTemplateId\]/);
  assert.match(migration, /REFERENCES "GovernedJourney"\("id", "relationTemplateId"\)/);
  assert.match(migration, /REFERENCES "GovernedJourneyInvitation"\("id", "relationTemplateId"\)/);
  assert.equal((migration.match(/ON DELETE RESTRICT ON UPDATE RESTRICT/g) ?? []).length, 5);
});

test("only one active assignment exists per stable expected role", () => {
  assert.match(migration, /CREATE UNIQUE INDEX "ExpectedRoleAssignment_active_role_key"/);
  assert.match(migration, /\("governedJourneyId", "expectedRoleId"\)\s*WHERE "revokedAt" IS NULL/);
});

test("migration is additive and performs no legacy backfill", () => {
  assert.doesNotMatch(migration, /^\s*(?:DROP|DELETE|UPDATE|TRUNCATE|INSERT)\b/im);
  assert.match(schema, /revokedAt\s+DateTime\?/);
  assert.match(schema, /revokedByUserId\s+String\?/);
});
