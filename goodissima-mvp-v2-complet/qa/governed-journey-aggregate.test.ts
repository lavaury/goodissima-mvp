import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260805120000_add_governed_journey_aggregate/migration.sql");
const service = read("lib/governed-journey/service.ts");
const cockpit = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");

test("the journey aggregate is a unique RelationTemplate extension with an optional legacy case", () => {
  assert.match(schema, /model RelationTemplate \{[\s\S]*governedJourney GovernedJourney\?/);
  assert.match(schema, /model GovernedJourney \{[\s\S]*relationCaseId String\?[\s\S]*relationTemplateId String @unique[\s\S]*createdFromTemplateVersionId String[\s\S]*authorityUserId String/);
  assert.match(schema, /relationCase RelationCase\? @relation\(fields: \[relationCaseId\], references: \[id\], onDelete: Restrict, onUpdate: Restrict\)/);
  assert.match(schema, /authority User @relation\(fields: \[authorityUserId\], references: \[id\], onDelete: Restrict, onUpdate: Restrict\)/);
  assert.match(schema, /fields: \[createdFromTemplateVersionId, relationTemplateId\], references: \[id, templateId\], onDelete: Restrict/);
  assert.match(schema, /model GovernedJourneyEvent \{[\s\S]*type GovernedJourneyEventType/);
  assert.doesNotMatch(schema, /GovernedMemoryScope[^\n]*GovernedJourney/);
});

test("the additive migration enforces lifecycle and RLS without inventing historical instances", () => {
  assert.match(migration, /GovernedJourney_lifecycle_check/);
  assert.doesNotMatch(migration, /INSERT INTO "GovernedJourney"/);
  assert.doesNotMatch(migration, /INSERT INTO "GovernedJourneyEvent"/);
  assert.doesNotMatch(migration, /deterministic_definitions|inserted_journeys|gj_backfill_|gje_backfill_/);
  assert.match(migration, /ON DELETE RESTRICT/g);
  assert.match(migration, /ALTER TABLE "GovernedJourney" ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE "GovernedJourneyEvent" ENABLE ROW LEVEL SECURITY/);
});

test("creation validates authority and template version then writes instance and event atomically", () => {
  assert.match(service, /prisma\.\$transaction/);
  assert.match(service, /relationCase\.ownerId !== input\.authorityUserId/);
  assert.match(service, /templateVersion\.templateId !== relationTemplateId/);
  assert.match(service, /tx\.governedJourney\.create/);
  assert.match(service, /events:\s*\{\s*create:/);
  assert.match(service, /type: "CREATED"/);
  assert.match(service, /toStatus: "DRAFT"/);
  assert.match(service, /sequence: 1/);
  assert.doesNotMatch(service, /governedMemory|openai|mistral|embedding/i);
  assert.doesNotMatch(service, /\.delete\(|\.deleteMany\(/);
});

test("the legacy cockpit remains explicitly keyed by FormTemplate", () => {
  assert.match(cockpit, /prisma\.formTemplate\.findUnique/);
  assert.match(cockpit, /where: \{ id: params\.id \}/);
  assert.doesNotMatch(cockpit, /prisma\.governedJourney\.(?:find|create|update|delete)/);
});

test("the migration creates no governed-memory row", () => {
  assert.doesNotMatch(migration, /INSERT INTO "GovernedMemory/);
  assert.doesNotMatch(migration, /UPDATE "GovernedMemory/);
});

test("one template version and one case are not treated as proof of instantiation", () => {
  assert.doesNotMatch(migration, /COUNT\(DISTINCT rc\."id"\)|COUNT\(DISTINCT tv\."id"\)/);
  assert.match(migration, /No legacy row is inserted/);
  assert.doesNotMatch(migration, /MIN\(rc\."ownerId"\)|CURRENT_TIMESTAMP, CURRENT_TIMESTAMP[\s\S]*FROM/);
});
