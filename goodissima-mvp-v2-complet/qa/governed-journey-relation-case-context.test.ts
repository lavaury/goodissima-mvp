import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const migrationPath = new URL("../prisma/migrations/20260809120000_add_governed_journey_relation_case_context/migration.sql", import.meta.url);
const aggregateMigrationPath = new URL("../prisma/migrations/20260805120000_add_governed_journey_aggregate/migration.sql", import.meta.url);
const lifecyclePath = new URL("../lib/governed-journey/lifecycle.ts", import.meta.url);
const creationPath = new URL("../lib/governed-journey/service.ts", import.meta.url);
const listRoutePath = new URL("../app/cases/[caseId]/journeys/page.tsx", import.meta.url);
const detailRoutePath = new URL("../app/cases/[caseId]/journeys/[journeyId]/page.tsx", import.meta.url);
const cockpitPath = new URL("../app/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url);

test("R1-C1 declares the same-template context and its inverse relations", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const context = schema.match(/model GovernedJourneyRelationCase \{[\s\S]*?\n\}/)?.[0] ?? "";
  for (const field of ["governedJourneyId", "relationCaseId", "relationTemplateId", "createdByUserId", "createdAt"]) {
    assert.match(context, new RegExp(`\\b${field}\\b`));
  }
  assert.match(context, /createdByUserId\s+String\b/);
  assert.match(context, /fields: \[governedJourneyId, relationTemplateId\], references: \[id, relationTemplateId\], onDelete: Restrict, onUpdate: Restrict/);
  assert.match(context, /fields: \[relationCaseId, relationTemplateId\], references: \[id, templateId\], onDelete: Restrict, onUpdate: Restrict/);
  assert.match(context, /"GovernedJourneyRelationCaseCreator"[\s\S]*onDelete: Restrict, onUpdate: Restrict/);
  assert.match(context, /@@id\(\[governedJourneyId, relationCaseId\]\)/);
  assert.match(context, /@@unique\(\[relationCaseId, relationTemplateId\]\)/);
  assert.match(context, /@@index\(\[relationTemplateId\]\)/);
  assert.match(context, /@@index\(\[createdByUserId, createdAt\]\)/);
  assert.match(schema, /createdGovernedJourneyRelationCaseContexts GovernedJourneyRelationCase\[\] @relation\("GovernedJourneyRelationCaseCreator"\)/);
  assert.match(schema, /governedJourneyContexts GovernedJourneyRelationCase\[\]/);
  assert.match(schema, /relationCaseContexts GovernedJourneyRelationCase\[\]/);
});

test("R1-C1 adds the exact candidate keys required by PostgreSQL", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const relationCase = schema.match(/model RelationCase \{[\s\S]*?\n\}/)?.[0] ?? "";
  const journey = schema.match(/model GovernedJourney \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(relationCase, /@@unique\(\[id, templateId\]\)/);
  assert.match(journey, /@@unique\(\[id, relationTemplateId\]\)/);
  assert.match(journey, /relationCaseId String\?/);
});

test("R1-C1 migration creates an empty restricted RLS structure", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /CREATE UNIQUE INDEX "GovernedJourney_id_relationTemplateId_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX "RelationCase_id_templateId_key"/);
  assert.match(migration, /CREATE TABLE "GovernedJourneyRelationCase"/);
  for (const column of ["governedJourneyId", "relationCaseId", "relationTemplateId", "createdByUserId", "createdAt"]) {
    assert.match(migration, new RegExp(`"${column}"[^\\n]*NOT NULL`));
  }
  assert.match(migration, /PRIMARY KEY \("governedJourneyId", "relationCaseId"\)/);
  assert.match(migration, /UNIQUE INDEX "GovernedJourneyRelationCase_relationCaseId_relationTemplateId_key"/);
  assert.match(migration, /REFERENCES "GovernedJourney"\("id", "relationTemplateId"\)/);
  assert.match(migration, /REFERENCES "RelationCase"\("id", "templateId"\)/);
  assert.match(migration, /REFERENCES "User"\("id"\)/);
  assert.equal((migration.match(/ON DELETE RESTRICT ON UPDATE RESTRICT/g) ?? []).length, 3);
  assert.match(migration, /ALTER TABLE "GovernedJourneyRelationCase" ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /CREATE POLICY/i);
});

test("R1-C1 migration contains no data, backfill, cascade, memory or event operation", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(migration, /^\s*(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)\b/im);
  assert.doesNotMatch(migration, /backfill|CASCADE|GovernedMemory|GovernedJourneyEvent/i);
  assert.doesNotMatch(migration, /SELECT[\s\S]*GovernedJourney|relationCaseId"\s+FROM/i);
});

test("R1-C1 leaves creation, lifecycle, GJ-4 and the cockpit unchanged", async () => {
  const [aggregateMigration, creation, lifecycle, listRoute, detailRoute, cockpit] = await Promise.all([
    readFile(aggregateMigrationPath, "utf8"), readFile(creationPath, "utf8"), readFile(lifecyclePath, "utf8"),
    readFile(listRoutePath, "utf8"), readFile(detailRoutePath, "utf8"), readFile(cockpitPath, "utf8"),
  ]);
  assert.doesNotMatch(aggregateMigration, /GovernedJourneyRelationCase/);
  assert.doesNotMatch(creation, /GovernedJourneyRelationCase|relationCaseContexts/);
  assert.doesNotMatch(lifecycle, /GovernedJourneyRelationCase|relationCaseContexts/);
  assert.match(listRoute, /notFound\(\)/);
  assert.match(detailRoute, /notFound\(\)/);
  assert.doesNotMatch(cockpit, /GovernedJourneyRelationCase|relationCaseContexts/);
});
