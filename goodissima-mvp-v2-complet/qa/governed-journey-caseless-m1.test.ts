import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260920210000_expand_governed_journey_caseless_events/migration.sql", import.meta.url), "utf8");

test("M1 binds case-less events to Journey and authority independently of case", () => {
  const event = schema.match(/model GovernedJourneyEvent \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(event, /relationCaseId\s+String\?/);
  assert.match(event, /@relation\(fields: \[governedJourneyId, authorityUserId\], references: \[id, authorityUserId\]/);
  assert.match(migration, /FOREIGN KEY \("governedJourneyId", "authorityUserId"\)/);
  assert.match(migration, /NEW\."relationCaseId" IS DISTINCT FROM journey_case_id/);
});

test("M1 keeps Journey identity stable and event provenance strong", () => {
  assert.match(migration, /NEW\."relationTemplateId" IS DISTINCT FROM OLD\."relationTemplateId"/);
  assert.match(migration, /NEW\."authorityUserId" IS DISTINCT FROM OLD\."authorityUserId"/);
  assert.match(migration, /FOREIGN KEY \("governedJourneyEventId", "governedJourneyId"\)/);
  assert.match(migration, /NEW\."relationCaseId" IS DISTINCT FROM event_case_id/);
  assert.match(migration, /NEW\."governedJourneyId" IS NULL THEN/);
});

test("M1 preserves lifecycle, append-only and historical data", () => {
  assert.doesNotMatch(migration, /DROP (?:TRIGGER|CONSTRAINT) "GovernedJourneyEvent_(?:append_only|transition_check|governedJourneyId_sequence_key)"/i);
  assert.doesNotMatch(migration, /\b(?:UPDATE|DELETE|TRUNCATE)\s+"GovernedJourney(?:Event)?"/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+"GovernedJourney(?:Event)?"/i);
  assert.doesNotMatch(migration, /DEFERRABLE INITIALLY DEFERRED|each Journey.*CREATED/i);
});
