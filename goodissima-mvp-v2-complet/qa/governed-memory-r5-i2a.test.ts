import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260812120000_add_governed_memory_event_journey_scope/migration.sql");
const repository = read("lib/governed-memory/persistence/repository.ts");
const service = read("lib/governed-memory/persistence/service.ts");
const permissions = read("lib/governed-memory/permissions.ts");

test("memory events have a structural root and either case or journey scope", () => {
  const start = schema.indexOf("model GovernedMemoryEvent {");
  const block = schema.slice(start, schema.indexOf("\n}", start));
  assert.match(block, /relationTemplateId\s+String/);
  assert.match(block, /governedJourneyId\s+String\?/);
  assert.match(block, /relationCaseId\s+String\?/);
  assert.match(block, /fields: \[governedJourneyId, relationTemplateId\], references: \[id, relationTemplateId\]/);
  assert.match(block, /fields: \[relationCaseId, relationTemplateId\], references: \[id, templateId\]/);
  assert.match(migration, /GovernedMemoryEvent_scope_check/);
  assert.match(migration, /relationCaseId" IS NOT NULL OR "governedJourneyId" IS NOT NULL/);
});

test("the migration backfills only the structural root and refuses incomplete history", () => {
  assert.match(migration, /SET "relationTemplateId" = relation_case\."templateId"/);
  assert.match(migration, /RAISE EXCEPTION 'GovernedMemoryEvent relationTemplateId backfill incomplete'/);
  assert.match(migration, /ALTER COLUMN "relationTemplateId" SET NOT NULL/);
  assert.doesNotMatch(migration, /UPDATE "GovernedJourney"|SET "governedJourneyId"/);
});

test("historical event writes resolve their root server-side and remain atomic", () => {
  assert.match(repository, /relationCase\.findUnique\(\{ where: \{ id: input\.relationCaseId \}, select: \{ templateId: true \} \}\)/);
  assert.match(repository, /relationTemplateId: relationCase\.templateId, governedJourneyId: null, actorType: "HUMAN"/);
  assert.doesNotMatch(service, /relationTemplateId/);
  for (const event of ["FACT_PROPOSED", "DECISION_RECORDED", "SOURCE_REGISTERED", "SOURCE_PROMOTED"]) assert.match(repository, new RegExp(event));
});

test("REGISTER_SOURCE belongs only to the three authorized writing roles", () => {
  for (const role of ["RELATION_CASE_OWNER", "MEMORY_STEWARD", "MEMORY_DELEGATE"]) assert.match(permissions, new RegExp(`${role}: \\[.*REGISTER_SOURCE`));
  for (const role of ["CONTRIBUTOR", "READER", "REVOKED_PARTICIPANT", "SYSTEM", "AI_ASSISTANT"]) {
    const line = permissions.split("\n").find((candidate) => candidate.includes(`${role}:`)) ?? "";
    assert.doesNotMatch(line, /REGISTER_SOURCE/);
  }
  assert.match(service, /permissions\.has\("REGISTER_SOURCE"\)/);
  assert.doesNotMatch(repository, /permission:\s*"REGISTER_SOURCE"/);
});

test("R5-I2a adds no journey command, idempotence, policy or data", () => {
  assert.doesNotMatch(repository, /proposeJourneyFact|createJourneyDecision|registerJourneySource|GovernedMemoryCreationRequest/);
  assert.doesNotMatch(migration, /CREATE POLICY|INSERT INTO|GovernedMemoryAccessGrant|GovernedMemoryRoleAssignment/);
});
