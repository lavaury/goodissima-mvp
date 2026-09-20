import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  "prisma/migrations/20260921010000_enforce_governed_journey_created_event/migration.sql",
  "utf8",
);

test("M2 checks historical roots without changing business rows", () => {
  assert.match(sql, /HAVING count\(e\.id\) <> 1/);
  assert.match(sql, /"actorUserId" IS DISTINCT FROM j\."authorityUserId"/);
  assert.match(sql, /"relationCaseId" IS DISTINCT FROM j\."relationCaseId"/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?"GovernedJourney(?:Event)?"/i);
});

test("M2 checks exactly one valid CREATED at transaction commit", () => {
  assert.match(sql, /CREATE CONSTRAINT TRIGGER "GovernedJourney_created_at_commit"/);
  assert.match(sql, /AFTER INSERT ON "GovernedJourney"\s+DEFERRABLE INITIALLY DEFERRED/);
  assert.match(sql, /e\.type = 'CREATED'/);
  assert.match(sql, /e\.sequence = 1/);
  assert.match(sql, /e\."fromStatus" IS NULL/);
  assert.match(sql, /e\."toStatus" = 'DRAFT'/);
  assert.match(sql, /e\."actorUserId" = NEW\."authorityUserId"/);
  assert.match(sql, /e\."authorityUserId" = NEW\."authorityUserId"/);
  assert.match(sql, /e\."relationCaseId" IS NOT DISTINCT FROM NEW\."relationCaseId"/);
});
