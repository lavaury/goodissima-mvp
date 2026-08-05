import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260808120000_reconcile_governed_journey_identity/migration.sql");
const lifecycleMigration = read("prisma/migrations/20260806121000_add_governed_journey_lifecycle_contracts/migration.sql");
const creationAction = read("lib/governance-journey-actions.ts");
const cockpit = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");
const relationTemplateModel = schema.match(/model RelationTemplate \{[\s\S]*?\n\}/)?.[0] ?? "";
const governedJourneyModel = schema.match(/model GovernedJourney \{[\s\S]*?\n\}/)?.[0] ?? "";

test("R1-A anchors at most one extension on each RelationTemplate", () => {
  assert.match(relationTemplateModel, /governedJourney GovernedJourney\?/);
  assert.doesNotMatch(relationTemplateModel, /governedJourneys GovernedJourney\[\]/);
  assert.match(governedJourneyModel, /relationTemplateId String @unique/);
  assert.match(migration, /GROUP BY "relationTemplateId"\s+HAVING COUNT\(\*\) > 1/);
  assert.match(migration, /RAISE EXCEPTION 'R1-A migration aborted: duplicate GovernedJourney relationTemplateId values require human reconciliation'/);
  assert.match(migration, /CREATE UNIQUE INDEX "GovernedJourney_relationTemplateId_key"/);
});

test("R1-A makes the legacy case optional and decouples authority", () => {
  assert.match(schema, /relationCaseId String\?/);
  assert.match(schema, /relationCase RelationCase\? @relation\(fields: \[relationCaseId\], references: \[id\], onDelete: Restrict, onUpdate: Restrict\)/);
  assert.match(schema, /authority User @relation\(fields: \[authorityUserId\], references: \[id\], onDelete: Restrict, onUpdate: Restrict\)/);
  assert.match(migration, /DROP CONSTRAINT "GovernedJourney_relationCaseId_authorityUserId_fkey"/);
  assert.match(migration, /ALTER COLUMN "relationCaseId" DROP NOT NULL/);
  assert.match(migration, /GovernedJourney_relationCaseId_fkey[\s\S]*REFERENCES "RelationCase"\("id"\)[\s\S]*ON DELETE RESTRICT ON UPDATE RESTRICT/);
  assert.doesNotMatch(migration, /DROP CONSTRAINT "GovernedJourney_authorityUserId_fkey"/);
});

test("R1-A migration has no data, memory, enum, UI or destructive history operation", () => {
  assert.doesNotMatch(migration, /^\s*(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)\b/im);
  assert.doesNotMatch(migration, /backfill|GovernedMemory|ALTER TYPE|CREATE TYPE|DROP TYPE|CASCADE/i);
  assert.doesNotMatch(migration, /GovernedJourneyEvent_(?:append_only|transition|sequence)|reject_governed_journey_event_mutation/);
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY|DROP POLICY|DROP TRIGGER|DROP FUNCTION/i);
  assert.match(lifecycleMigration, /BEFORE UPDATE OR DELETE ON "GovernedJourneyEvent"/);
  assert.match(lifecycleMigration, /GovernedJourneyEvent_sequence_check/);
});

test("R1-A leaves creation, lifecycle, cockpit and GJ-4 product exposure frozen", () => {
  assert.doesNotMatch(creationAction, /(?:tx|prisma)\.governedJourney\.create|createGovernedJourney\s*\(/);
  assert.match(cockpit, /prisma\.formTemplate\.findUnique\(\{\s+where: \{ id: params\.id \}/);
  assert.doesNotMatch(cockpit, /governed-journey\/(?:service|lifecycle)|(?:activate|suspend|resume|close|cancel)GovernedJourney\s*\(/);
  assert.doesNotMatch(migration, /status|startedAt|suspendedAt|closedAt|cancelledAt|currentStepKey|title/);
});
