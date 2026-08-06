import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260811120000_add_governed_memory_journey_scope/migration.sql", "utf8");
const repository = readFileSync("lib/governed-memory/persistence/repository.ts", "utf8");
const service = readFileSync("lib/governed-memory/persistence/service.ts", "utf8");

test("memory objects have mandatory structural roots and optional case and journey scopes", () => {
  for (const model of ["GovernedMemoryFact", "GovernedMemoryDecision", "GovernedMemorySource"]) {
    const start = schema.indexOf(`model ${model} {`);
    const block = schema.slice(start, schema.indexOf("\n}", start));
    assert.match(block, /relationTemplateId String/);
    assert.match(block, /relationCaseId String\?/);
    assert.match(block, /governedJourneyId String\?/);
  }
  assert.equal((migration.match(/_scope_check/g) ?? []).length, 3);
  assert.match(migration, /No GovernedJourney is inferred/);
});

test("REGISTER_SOURCE exists while historical source authorization remains unchanged", () => {
  assert.match(schema, /VIEW_SOURCES\s+REGISTER_SOURCE\s+PROPOSE_FACT/);
  assert.match(service, /permissions\.has\("VIEW_SOURCES"\)/);
  assert.doesNotMatch(service, /permissions\.has\("REGISTER_SOURCE"\)/);
  assert.doesNotMatch(repository, /permission:\s*"REGISTER_SOURCE"/);
});

test("creation request is unique, formatted, scoped, complete and server-only", () => {
  assert.match(schema, /model GovernedMemoryCreationRequest/);
  assert.match(schema, /@@unique\(\[requesterUserId, requestKey\]\)/);
  for (const result of ["factId", "decisionId", "sourceId"]) assert.match(schema, new RegExp(`${result} String\\? @unique`));
  for (const check of ["requestKey_format_check", "requestFingerprint_format_check", "completion_check"]) assert.match(migration, new RegExp(check));
  assert.match(migration, /GovernedMemoryCreationRequest" ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /CREATE POLICY/);
});

test("all existing Prisma creations resolve relationTemplateId inside transactions", () => {
  assert.match(repository, /resolveGovernedMemoryScope\(tx, input\.relationCaseId/);
  assert.match(repository, /relationCase\.templateId/);
  assert.match(repository, /governedJourney\.findFirst/);
  assert.match(repository, /GOVERNED_MEMORY_SCOPE_MISMATCH/);
  assert.equal((repository.match(/governedMemoryFact\.create/g) ?? []).length, 2);
  assert.equal((repository.match(/governedMemoryDecision\.create/g) ?? []).length, 2);
  assert.equal((repository.match(/governedMemorySource\.create/g) ?? []).length, 1);
  assert.equal((repository.match(/\.\.\.scope/g) ?? []).length, 5);
});

test("public creation contracts do not accept structural authority from clients", () => {
  for (const command of ["proposeFact", "createDecisionDraft", "registerMemorySource", "promotePrivateMessageExcerpt"]) {
    const start = service.indexOf(`function ${command}`);
    const signature = service.slice(start, service.indexOf(") {", start));
    assert.ok(start >= 0, command);
    assert.doesNotMatch(signature, /relationTemplateId/);
  }
});

test("initial states, events and atomic transactions remain unchanged", () => {
  assert.match(repository, /status: "PROPOSED"/);
  assert.match(repository, /status: "DRAFT"/);
  assert.match(service, /status: "ACTIVE"/);
  for (const event of ["FACT_PROPOSED", "DECISION_RECORDED", "SOURCE_REGISTERED", "SOURCE_PROMOTED"]) assert.match(repository, new RegExp(event));
  for (const command of ["createProposedFact", "supersedeFactTransactionally", "createDraftDecision", "createSuccessorDecision", "registerSource"]) {
    const start = repository.indexOf(`${command}(`);
    assert.ok(repository.slice(start, start + 1_600).includes("$transaction"), command);
  }
});

test("R5-I1 adds no UI, route, automatic journey creation or seeded data", () => {
  assert.doesNotMatch(repository, /governedJourney\.create/);
  assert.doesNotMatch(migration, /INSERT INTO/);
  assert.doesNotMatch(migration, /UPDATE "GovernedJourney"/);
});
