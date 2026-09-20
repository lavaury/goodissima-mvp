import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260918213000_add_governed_participant_selection/migration.sql",
  "utf8",
);

test("selection foundation exposes both targets, four sources and six lifecycle states", () => {
  for (const value of ["JOURNEY", "MEETING"]) assert.match(schema, new RegExp(`\\b${value}\\b`));
  for (const value of ["JOURNEY_MEMBERS", "DIRECTORY", "MATCHING", "MEETING_HISTORY"]) {
    assert.match(schema, new RegExp(`\\b${value}\\b`));
  }
  for (const value of ["DRAFT", "UNDER_REVIEW", "VALIDATED", "MATERIALIZED", "FAILED", "CANCELLED"]) {
    assert.match(schema, new RegExp(`\\b${value}\\b`));
  }
});

test("selection is rooted in a Journey and has an explicit optional meeting target", () => {
  assert.match(schema, /model GovernedParticipantSelection \{[\s\S]*ownerId\s+String[\s\S]*governedJourneyId\s+String[\s\S]*targetType\s+GovernedParticipantSelectionTargetType[\s\S]*communicationSessionId\s+String\?/);
  assert.match(migration, /GovernedParticipantSelection_session_fkey/);
  assert.match(migration, /FOREIGN KEY \("communicationSessionId", "ownerId", "relationTemplateId"\)/);
  assert.match(migration, /GovernedParticipantSelection_journey_fkey/);
  const correction = readFileSync("prisma/migrations/20260918220000_generalize_governed_participant_selection_target/migration.sql", "utf8");
  assert.match(correction, /GovernedParticipantSelection_target_check/);
  assert.match(correction, /'JOURNEY' AND "communicationSessionId" IS NULL/);
  assert.match(correction, /'MEETING' AND "communicationSessionId" IS NOT NULL/);
  assert.match(correction, /FOREIGN KEY \("selectionId"\) REFERENCES "GovernedParticipantSelection"\("id"\)/);
});

test("canonical identity is separate from provenance and never uses display name", () => {
  assert.match(schema, /canonicalUserId\s+String\?/);
  assert.match(schema, /canonicalInvitationId\s+String\?/);
  assert.match(schema, /canonicalDirectoryProfileId\s+String\?/);
  assert.match(schema, /sourceDirectoryProfileId\s+String\?/);
  assert.match(schema, /sourceMatchingResultId\s+String\?/);
  assert.match(schema, /sourceMeetingParticipantId\s+String\?/);
  assert.match(migration, /canonical_identity_xor_check/);
  assert.doesNotMatch(migration, /UNIQUE[^;]*snapshotDisplayName/is);
});

test("one canonical identity per selection is enforced with partial unique indexes", () => {
  assert.match(migration, /selection_user_key[\s\S]*WHERE "canonicalUserId" IS NOT NULL/);
  assert.match(migration, /selection_invitation_key[\s\S]*WHERE "canonicalInvitationId" IS NOT NULL/);
  assert.match(migration, /selection_directory_key[\s\S]*WHERE "canonicalDirectoryProfileId" IS NOT NULL/);
});

test("Journey and meeting materializations are exclusive and target-checked", () => {
  const correction = readFileSync("prisma/migrations/20260918220000_generalize_governed_participant_selection_target/migration.sql", "utf8");
  assert.match(schema, /materializedJourneyInvitationId\s+String\?\s+@unique/);
  assert.match(schema, /materializedMeetingParticipantId\s+String\?\s+@unique(?:\([^\n]+\))?/);
  assert.match(correction, /materialization_xor_check/);
  assert.match(correction, /num_nonnulls\("materializedJourneyInvitationId", "materializedMeetingParticipantId"\) <= 1/);
  assert.match(correction, /Journey invitation materialization requires a JOURNEY target/);
  assert.match(correction, /Meeting participant materialization requires a MEETING target/);
  assert.match(correction, /Meeting participant materialization is outside the target meeting/);
  assert.match(correction, /GovernedParticipantSelectionItem is outside the target Journey/);
  const roleAssignmentModel = schema.match(/model GovernedJourneyExpectedRoleAssignment \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(roleAssignmentModel, /participantSelection/);
});

test("selection events are append-only", () => {
  assert.match(migration, /GovernedParticipantSelectionEvent_append_only/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "GovernedParticipantSelectionEvent"/);
  assert.match(migration, /GovernedParticipantSelectionEvent is append-only/);
});

test("historical records use restrictive deletion and minimized JSON snapshots", () => {
  assert.doesNotMatch(migration, /GovernedParticipantSelection[^;]*ON DELETE CASCADE/is);
  assert.match(schema, /criteria\s+Json/);
  assert.match(schema, /materializationSummary\s+Json\?/);
  for (const forbidden of ["accessToken", "credential", "conversation"]) {
    assert.doesNotMatch(schema.slice(schema.indexOf("model GovernedParticipantSelection"), schema.indexOf("model GovernedJourneyExpectedRoleAssignment")), new RegExp(forbidden, "i"));
  }
});
