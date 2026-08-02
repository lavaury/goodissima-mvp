import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260804120000_add_governed_memory_persistence/migration.sql");
const repository = read("lib/governed-memory/persistence/repository.ts");

test("schema persists the eight MG-2 objects and explicit memory authority", () => {
  for (const model of ["GovernedMemoryFact", "GovernedMemoryDecision", "GovernedMemorySource", "GovernedMemoryRelation", "GovernedMemoryValidation", "GovernedMemoryDispute", "GovernedMemoryAccessGrant", "GovernedMemoryEvent", "GovernedMemoryRoleAssignment"]) assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.doesNotMatch(schema, /model GovernedMemorySynthesis/);
  for (const relation of ["memoryFacts", "memoryDecisions", "memorySources", "memoryRelations", "memoryValidations", "memoryDisputes", "memoryAccessGrants", "memoryEvents", "memoryRoleAssignments"]) assert.match(schema, new RegExp(relation));
});

test("migration is additive, restricts structural deletion and enables deny-by-default RLS", () => {
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DROP TYPE/);
  assert.match(migration, /REFERENCES "RelationCase"\("id"\) ON DELETE RESTRICT ON UPDATE RESTRICT/g);
  assert.equal((migration.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length, 9);
  assert.doesNotMatch(migration, /CREATE POLICY/);
});

test("SQL enforces time, state, actor, subject and promotion coherence", () => {
  for (const name of ["GovernedMemoryFact_interval_check", "GovernedMemoryFact_establishment_check", "GovernedMemoryDecision_validation_check", "GovernedMemorySource_message_promotion_check", "GovernedMemoryAccessGrant_subject_check", "GovernedMemoryAccessGrant_residual_check", "GovernedMemoryEvent_actor_check"]) assert.ok(migration.includes(name));
  assert.match(migration, /length\(btrim\(COALESCE\("excerpt", ''\)\)\) BETWEEN 1 AND 2000/);
  assert.match(migration, /GovernedMemoryRoleAssignment_active_steward_key/);
  assert.match(schema, /fields: \[actorRepresentationId, actorUserId\], references: \[id, ownerId\]/);
  assert.match(migration, /FOREIGN KEY \("actorRepresentationId", "actorUserId"\) REFERENCES "Representation"\("id", "ownerId"\) ON DELETE RESTRICT ON UPDATE RESTRICT/);
});

test("generic relations persist only the six MG-2 combinations", () => {
  const constraint = migration.slice(migration.indexOf("GovernedMemoryRelation_allowed_pair_check"), migration.indexOf("CREATE TABLE \"GovernedMemoryValidation\""));
  for (const allowed of ["SUPPORTED_BY", "DERIVED_FROM", "REPLACES", "CORRECTS", "CANCELS", "COMPLEMENTS"]) assert.ok(constraint.includes(allowed));
  for (const refused of ["CONTESTS", "VALIDATES", "SUMMARIZES"]) assert.doesNotMatch(constraint, new RegExp(`'${refused}'`));
});

test("revocation pairs and withdrawn disputes are strictly closed", () => {
  assert.match(migration, /GovernedMemoryAccessGrant_revocation_check[\s\S]*?"revokedAt" IS NULL AND "revokedByUserId" IS NULL[\s\S]*?"revokedAt" IS NOT NULL AND "revokedByUserId" IS NOT NULL/);
  assert.match(migration, /GovernedMemoryRoleAssignment_revocation_check[\s\S]*?"revokedAt" IS NULL AND "revokedByUserId" IS NULL[\s\S]*?"revokedAt" IS NOT NULL AND "revokedByUserId" IS NOT NULL/);
  assert.match(migration, /"status" = 'WITHDRAWN' AND "resolvedAt" IS NOT NULL AND "resolvedByUserId" IS NOT NULL AND length\(btrim\(COALESCE\("resolution", ''\)\)\) > 0/);
});

test("repository scopes every historical list and orders deterministically", () => {
  for (const fn of ["listFactsKnownAt", "listFactsAtDate", "listDecisionsAtDate", "listEffectiveGrantsAt", "listEventsAtDate"]) assert.match(repository, new RegExp(`${fn}\\(relationCaseId`));
  assert.match(repository, /recordedAt: \{ lte: at \}/);
  assert.match(repository, /effectiveFrom: \{ lte: at \}/);
  assert.match(repository, /effectiveUntil: \{ gt: at \}/);
  assert.match(repository, /orderBy: \[\{ recordedAt: "asc" \}, \{ id: "asc" \}\]/);
  assert.match(repository, /boundedLimit/);
});

test("structural transitions and events share Prisma transactions", () => {
  for (const fn of ["createProposedFact", "establishFactConditionally", "supersedeFactTransactionally", "createDraftDecision", "validateDecisionConditionally", "registerSource", "grantPermission", "revokePermissionConditionally", "appendValidation", "openDispute", "resolveDisputeConditionally"]) {
    const start = repository.indexOf(`${fn}(`); assert.ok(start >= 0, fn); assert.ok(repository.slice(start, start + 900).includes("$transaction"), `${fn} must transact`);
  }
  assert.match(repository, /updateMany\(\{ where: \{ id: input\.id, relationCaseId: input\.relationCaseId, status: "PROPOSED", updatedAt: input\.expectedUpdatedAt/);
});
