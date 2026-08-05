import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260810120000_add_governed_journey_creation_request/migration.sql");
const action = read("lib/governance-journey-actions.ts");
const manualUi = read("app/gouvernance/nouveau/page.tsx");
const assistantUi = read("app/gouvernance/nouveau/GovernanceJourneyAssistant.tsx");
const cockpit = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");
const listRoute = read("app/cases/[caseId]/journeys/page.tsx");
const detailRoute = read("app/cases/[caseId]/journeys/[journeyId]/page.tsx");

test("R2-C1 declares the exact nullable idempotency structure and inverse relations", () => {
  const model = schema.match(/model GovernedJourneyCreationRequest \{[\s\S]*?\n\}/)?.[0] ?? "";
  for (const field of ["id", "requesterUserId", "requestKey", "requestFingerprint", "workspaceScopeKey", "createdAt", "completedAt"]) {
    assert.match(model, new RegExp(`\\b${field}\\b`));
  }
  for (const field of ["workspaceId", "relationTemplateId", "formTemplateId", "governedJourneyId"]) {
    assert.match(model, new RegExp(`\\b${field}\\s+String\\?`));
  }
  assert.match(model, /"GovernedJourneyCreationRequestRequester"[\s\S]*onDelete: Restrict, onUpdate: Restrict/);
  assert.equal((model.match(/onDelete: Restrict, onUpdate: Restrict/g) ?? []).length, 5);
  assert.match(schema, /governedJourneyCreationRequests GovernedJourneyCreationRequest\[\] @relation\("GovernedJourneyCreationRequestRequester"\)/);
  assert.match(schema, /governedJourneyCreationRequests GovernedJourneyCreationRequest\[\]/);
  assert.equal((schema.match(/governedJourneyCreationRequest GovernedJourneyCreationRequest\?/g) ?? []).length, 2);
  assert.match(schema, /creationRequest GovernedJourneyCreationRequest\?/);
});

test("R2-C1 declares owner-scoped and result uniqueness plus lookup indexes", () => {
  const model = schema.match(/model GovernedJourneyCreationRequest \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(model, /@@unique\(\[requesterUserId, requestKey\]\)/);
  for (const field of ["relationTemplateId", "formTemplateId", "governedJourneyId"]) {
    assert.match(model, new RegExp(`${field}\\s+String\\?\\s+@unique`));
  }
  assert.match(model, /@@index\(\[requesterUserId, createdAt\]\)/);
  assert.match(model, /@@index\(\[workspaceId, createdAt\]\)/);
  assert.doesNotMatch(model, /status|failedAt|payload|retryCount|expiresAt|deletedAt/);
});

test("the additive migration creates exact formats, completeness and restricted references", () => {
  assert.match(migration, /CREATE TABLE "GovernedJourneyCreationRequest"/);
  assert.match(migration, /PRIMARY KEY \("id"\)/);
  assert.match(migration, /requestKey" ~ '\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-4\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\$'/);
  assert.match(migration, /requestFingerprint" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /char_length\("workspaceScopeKey"\) BETWEEN 4 AND 256/);
  assert.match(migration, /LIKE 'id:%'[\s\S]*LIKE 'slug:%'/);
  for (const field of ["workspaceId", "relationTemplateId", "formTemplateId", "governedJourneyId"]) {
    assert.match(migration, new RegExp(`"${field}" TEXT,`));
    assert.match(migration, new RegExp(`"${field}" IS NULL[\\s\\S]*"${field}" IS NOT NULL`));
  }
  assert.match(migration, /"completedAt" IS NULL[\s\S]*"completedAt" IS NOT NULL/);
  for (const table of ["User", "Workspace", "RelationTemplate", "FormTemplate", "GovernedJourney"]) {
    assert.match(migration, new RegExp(`REFERENCES "${table}"\\("id"\\)[\\s\\S]*?ON DELETE RESTRICT ON UPDATE RESTRICT`));
  }
  assert.equal((migration.match(/ON DELETE RESTRICT ON UPDATE RESTRICT/g) ?? []).length, 5);
});

test("the migration enables server-only RLS and contains no history or executable behavior", () => {
  assert.match(migration, /ALTER TABLE "GovernedJourneyCreationRequest" ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /CREATE POLICY/i);
  assert.doesNotMatch(migration, /^\s*(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)\b/im);
  assert.doesNotMatch(migration, /backfill|CASCADE|CREATE TRIGGER|CREATE FUNCTION|GovernedMemory|GovernedJourneyEvent|GovernedJourneyRelationCase/i);
});

test("R2-C2 activates only the server protocol while UI, cockpit and GJ-4 remain frozen", () => {
  assert.match(action, /requestFingerprint|requestKey|isPrismaSerializationConflict/);
  assert.doesNotMatch(`${manualUi}\n${assistantUi}`, /requestKey|requestFingerprint|GovernedJourneyCreationRequest/);
  assert.match(action, /createGovernedJourneyExtensionInTransaction/);
  assert.match(cockpit, /prisma\.formTemplate\.findUnique/);
  assert.match(listRoute, /notFound\(\)/);
  assert.match(detailRoute, /notFound\(\)/);
});
