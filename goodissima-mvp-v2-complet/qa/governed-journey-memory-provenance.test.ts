import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260807120000_add_governed_journey_memory_provenance/migration.sql");
const scopeMigration = read("prisma/migrations/20260811120000_add_governed_memory_journey_scope/migration.sql");
const memoryRepository = read("lib/governed-memory/persistence/repository.ts");
const memoryReadRepository = read("lib/governed-memory/read/repository.ts");
const memoryService = read("lib/governed-memory/persistence/service.ts");
const journeyService = read("lib/governed-journey/service.ts");

test("memory provenance is optional and keeps historical sources unattached", () => {
  assert.match(schema, /model GovernedMemorySource \{[\s\S]*?governedJourneyId String\?[\s\S]*?governedJourneyEventId String\?/);
  assert.match(migration, /ADD COLUMN "governedJourneyId" TEXT,[\s\S]*ADD COLUMN "governedJourneyEventId" TEXT/);
  assert.doesNotMatch(migration, /ALTER COLUMN "governedJourney(?:Event)?Id" SET NOT NULL/);
  assert.doesNotMatch(migration, /^\s*(?:UPDATE|INSERT|DELETE)\s/im);
});

test("an event requires a journey before SQL and through a database check", () => {
  assert.match(migration, /CHECK \("governedJourneyEventId" IS NULL OR "governedJourneyId" IS NOT NULL\)/);
  const validation = memoryService.slice(memoryService.indexOf("const normalizeProvenance"), memoryService.indexOf("async function registerSourceSafely"));
  assert.match(validation, /governedJourneyEventId && !governedJourneyId/);
  assert.match(validation, /GovernedMemoryServiceError\("INVALID_INPUT", "A governed journey event requires its journey\."\)/);
  const registration = memoryService.slice(memoryService.indexOf("export async function registerMemorySource"), memoryService.indexOf("export async function promotePrivateMessageExcerpt"));
  assert.ok(registration.indexOf("const provenance = normalizeProvenance(input)") < registration.indexOf("await permission(input.relationCaseId"));
});

test("composite foreign keys bind source, journey, event and case", () => {
  assert.match(schema, /fields: \[governedJourneyId, relationTemplateId\], references: \[id, relationTemplateId\], onDelete: Restrict, onUpdate: Restrict/);
  assert.match(schema, /fields: \[relationCaseId, relationTemplateId\], references: \[id, templateId\], onDelete: Restrict, onUpdate: Restrict/);
  assert.match(schema, /fields: \[governedJourneyEventId, governedJourneyId, relationCaseId\], references: \[id, governedJourneyId, relationCaseId\], onDelete: Restrict, onUpdate: Restrict/);
  assert.match(schema, /@@unique\(\[id, governedJourneyId, relationCaseId\]\)/);
  assert.match(schema, /@@unique\(\[governedJourneyId, sequence\]\)/);
  assert.match(migration, /FOREIGN KEY \("governedJourneyId", "relationCaseId"\)[\s\S]*REFERENCES "GovernedJourney"\("id", "relationCaseId"\)[\s\S]*ON DELETE RESTRICT ON UPDATE RESTRICT/);
  assert.match(scopeMigration, /DROP CONSTRAINT "GovernedMemorySource_governedJourneyId_relationCaseId_fkey"/);
  assert.match(scopeMigration, /FOREIGN KEY \("governedJourneyId", "relationTemplateId"\) REFERENCES "GovernedJourney"\(id, "relationTemplateId"\) ON DELETE RESTRICT ON UPDATE RESTRICT/);
  assert.match(migration, /FOREIGN KEY \("governedJourneyEventId", "governedJourneyId", "relationCaseId"\)[\s\S]*REFERENCES "GovernedJourneyEvent"\("id", "governedJourneyId", "relationCaseId"\)[\s\S]*ON DELETE RESTRICT ON UPDATE RESTRICT/);
});

test("the additive migration changes no enum and performs no backfill", () => {
  assert.doesNotMatch(migration, /ALTER TYPE|CREATE TYPE|ADD VALUE|DROP|CASCADE/i);
  assert.doesNotMatch(migration, /RelationEvent|FormSubmission|Invitation|CommunicationSession|Template/);
  assert.equal((migration.match(/ADD COLUMN/g) ?? []).length, 2);
});

test("source creation receives only explicit normalized provenance", () => {
  assert.match(memoryService, /governedJourneyId = input\.governedJourneyId \?\? null/);
  assert.match(memoryService, /governedJourneyEventId = input\.governedJourneyEventId \?\? null/);
  assert.match(memoryService, /registerSourceSafely\(repository, \{ \.\.\.input, \.\.\.provenance,/);
  assert.doesNotMatch(memoryService, /findGovernedJourney|infer.*Journey|relationTemplateId|templateVersionId|invitation|communicationSession/i);
});

test("compatible provenance is delegated to SQL and technical errors are masked", () => {
  assert.match(memoryRepository, /governedMemorySource\.create\(\{ data: \{ \.\.\.input, \.\.\.scope \}, select: sourceSelect \}\)/);
  assert.match(memoryRepository, /governedJourney\.findFirst\(\{ where: \{ id: governedJourneyId, relationTemplateId: relationCase\.templateId \}/);
  assert.match(memoryService, /catch \{ throw new GovernedMemoryServiceError\("NOT_FOUND", "Memory provenance not found\."\); \}/);
  assert.doesNotMatch(memoryService, /PrismaClientKnownRequestError|DATABASE_URL|\.stack/);
});

test("provenance is returned internally without a deep journey include", () => {
  for (const implementation of [memoryRepository, memoryReadRepository]) {
    assert.match(implementation, /governedJourneyId: true, governedJourneyEventId: true/);
    assert.doesNotMatch(implementation, /include:\s*\{[\s\S]*governedJourney/);
  }
  assert.match(schema, /@@index\(\[relationCaseId, governedJourneyId, recordedAt, id\]\)/);
  assert.match(schema, /@@index\(\[relationCaseId, governedJourneyEventId\]\)/);
});

test("no repository can mutate provenance after source creation", () => {
  assert.doesNotMatch(memoryRepository, /update[^\n]*(governedJourneyId|governedJourneyEventId)/i);
  assert.doesNotMatch(memoryService, /update[^\n]*(governedJourneyId|governedJourneyEventId)/i);
  assert.doesNotMatch(memoryRepository, /connect:\s*\{[\s\S]*governedJourney/);
});

test("journey events and memory events remain separate without reciprocal automation", () => {
  assert.doesNotMatch(journeyService, /governedMemorySource|registerMemorySource|registerSource/);
  assert.doesNotMatch(memoryService, /transitionGovernedJourney|activateGovernedJourney|suspendGovernedJourney|resumeGovernedJourney|closeGovernedJourney|cancelGovernedJourney|governedJourneyEvent\.create/);
  assert.match(memoryRepository, /governedMemoryEvent\.create/);
  assert.doesNotMatch(memoryRepository, /governedJourneyEvent\.create/);
});

test("provenance grants no authority, access or automatic side effect", () => {
  const implementation = `${memoryService}\n${memoryRepository}\n${journeyService}`;
  assert.doesNotMatch(memoryService, /grantMemoryPermission[\s\S]*registerMemorySource|assignMemoryRole[\s\S]*registerMemorySource/);
  assert.doesNotMatch(implementation, /OpenAI|Mistral|embedding|notification\.create|invitation\.create|communicationSession\.create/i);
  assert.doesNotMatch(migration, /GovernedMemoryAccessGrant|GovernedMemoryRoleAssignment/);
});
