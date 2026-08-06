import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260813120000_add_governed_memory_qualification_journey_scope/migration.sql");
const roles = read("lib/governed-memory/persistence/journey-memory-role-repository.ts");
const repository = read("lib/governed-memory/persistence/repository.ts");

test("validations and disputes support coherent case or journey scopes", () => {
  for (const model of ["GovernedMemoryValidation", "GovernedMemoryDispute"]) {
    const block = schema.slice(schema.indexOf(`model ${model}`), schema.indexOf("model ", schema.indexOf(`model ${model}`) + 10));
    assert.match(block, /relationTemplateId\s+String/); assert.match(block, /governedJourneyId\s+String\?/); assert.match(block, /relationCaseId\s+String\?/);
  }
  assert.equal((migration.match(/scope_check/g) ?? []).length, 2);
  assert.match(migration, /ROOT_BACKFILL_INCOMPLETE/);
  assert.doesNotMatch(migration, /SET "governedJourneyId"/);
});

test("journey memory roles are explicit, restricted, revocable and server-only", () => {
  assert.match(schema, /model GovernedJourneyMemoryRoleAssignment/);
  assert.match(migration, /role_check[\s\S]*MEMORY_STEWARD[\s\S]*MEMORY_DELEGATE/);
  for (const forbidden of ["RELATION_CASE_OWNER", "CONTRIBUTOR", "READER", "SYSTEM", "AI_ASSISTANT"]) assert.doesNotMatch(migration.slice(migration.indexOf("role_check")), new RegExp(`IN \\([^)]*${forbidden}`));
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/); assert.doesNotMatch(migration, /CREATE POLICY/);
  assert.match(roles, /revokedAt: null/); assert.doesNotMatch(roles, /authorityUserId|ownerId|GovernedMemoryRoleAssignment/);
});

test("historical case writes resolve the structural root without public signature changes", () => {
  assert.match(repository, /resolveGovernedMemoryScope\(tx, input\.relationCaseId\)/);
  assert.match(repository, /governedJourneyId: null/);
  assert.doesNotMatch(repository, /appendValidation\(input:.*relationTemplateId: string/);
});

test("R5-IIIa1 adds no transition command, UI or automation", () => {
  assert.doesNotMatch(roles, /GovernedMemoryTransitionRequest|establishJourneyFact|disputeJourneyFact|validateJourneyDecision|Server Action|OpenAI|notification/i);
  assert.doesNotMatch(migration, /ARCHIVE_SOURCE|SOURCE_ARCHIVED|GovernedMemoryTransitionRequest/);
});
