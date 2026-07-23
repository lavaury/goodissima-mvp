import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MATCHING_RESULT_STATUSES,
  MATCHING_RUN_STATUSES,
  canPauseMatchingRun,
  canResumeMatchingRun,
  canTransitionMatchingResult,
  canTransitionMatchingRun,
  setMatchingRunPaused,
} from "../lib/matching-contracts.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = source("prisma/schema.prisma");
const migration = source("prisma/migrations/20260723120000_add_persistent_glink_matching/migration.sql");

test("Prisma schema defines persistent GLink matching aggregates", () => {
  assert.match(schema, /enum MatchingRunStatus \{[\s\S]*PREPARED[\s\S]*RUNNING[\s\S]*RESULTS_AVAILABLE[\s\S]*FAILED[\s\S]*CLOSED[\s\S]*\}/);
  assert.match(schema, /enum MatchingResultStatus \{[\s\S]*AVAILABLE[\s\S]*SELECTED[\s\S]*DISMISSED[\s\S]*LINKED[\s\S]*\}/);
  assert.match(schema, /model MatchingRun \{/);
  assert.match(schema, /gLink\s+GLink\s+@relation\("MatchingRunSourceGLink"[\s\S]*onDelete: Restrict\)/);
  assert.match(schema, /model MatchingResult \{/);
  assert.match(schema, /targetGLink\s+GLink\s+@relation\("MatchingResultTargetGLink"[\s\S]*onDelete: Restrict\)/);
  assert.match(schema, /relationCaseId String\?/);
  assert.match(schema, /relationCase RelationCase\?\s+@relation\([\s\S]*onDelete: SetNull\)/);
  assert.match(schema, /@@unique\(\[runId, targetGLinkId\]\)/);
  for (const index of [
    "@@index([gLinkId, createdAt])",
    "@@index([ownerId, status])",
    "@@index([ownerId, isPaused])",
    "@@index([runId, status])",
    "@@index([targetGLinkId])",
    "@@index([relationCaseId])",
  ]) assert.ok(schema.includes(index), `missing schema index ${index}`);
  assert.match(schema, /matchingRuns\s+MatchingRun\[\]\s+@relation\("MatchingRunSourceGLink"\)/);
  assert.match(schema, /matchingResults\s+MatchingResult\[\]\s+@relation\("MatchingResultTargetGLink"\)/);
});

test("legacy matching models and fields remain intact", () => {
  for (const contract of [
    "matchingEnabled",
    "model RelationEmbedding",
    "model EmbeddingJob",
    "model AIEvent",
    "model RelationEvent",
    "rules             Json?",
  ]) assert.ok(schema.includes(contract), `missing legacy contract ${contract}`);
});

test("migration creates only persistent matching structure and explicit RLS", () => {
  assert.match(migration, /CREATE TYPE "MatchingRunStatus"/);
  assert.match(migration, /CREATE TYPE "MatchingResultStatus"/);
  assert.match(migration, /CREATE TABLE "MatchingRun"/);
  assert.match(migration, /CREATE TABLE "MatchingResult"/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.match(migration, /ALTER TABLE "MatchingRun" ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE "MatchingResult" ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /^\s*(INSERT|UPDATE|DELETE)\b/im);
  assert.doesNotMatch(migration, /matchingEnabled|notification|email|invitation/i);
});

test("matching status contracts are exact", () => {
  assert.deepEqual(MATCHING_RUN_STATUSES, ["PREPARED", "RUNNING", "RESULTS_AVAILABLE", "FAILED", "CLOSED"]);
  assert.deepEqual(MATCHING_RESULT_STATUSES, ["AVAILABLE", "SELECTED", "DISMISSED", "LINKED"]);
});

test("run transitions keep CLOSED terminal and pause orthogonal", () => {
  assert.equal(canTransitionMatchingRun({ status: "PREPARED", isPaused: false }, "RUNNING"), true);
  assert.equal(canTransitionMatchingRun({ status: "RUNNING", isPaused: false }, "RESULTS_AVAILABLE"), true);
  assert.equal(canTransitionMatchingRun({ status: "RUNNING", isPaused: false }, "FAILED"), true);
  assert.equal(canTransitionMatchingRun({ status: "FAILED", isPaused: false }, "PREPARED"), true);
  assert.equal(canTransitionMatchingRun({ status: "CLOSED", isPaused: false }, "RUNNING"), false);
  assert.equal(canTransitionMatchingRun({ status: "PREPARED", isPaused: true }, "RUNNING"), false);

  const paused = setMatchingRunPaused({ status: "RESULTS_AVAILABLE", isPaused: false }, true);
  assert.deepEqual(paused, { status: "RESULTS_AVAILABLE", isPaused: true });
  assert.equal(paused && canResumeMatchingRun(paused), true);
  assert.deepEqual(paused && setMatchingRunPaused(paused, false), { status: "RESULTS_AVAILABLE", isPaused: false });
  assert.equal(canPauseMatchingRun({ status: "CLOSED", isPaused: false }), false);
});

test("result transitions require an open, unpaused run and prior selection before linking", () => {
  const activeRun = { status: "RESULTS_AVAILABLE" as const, isPaused: false };
  assert.equal(canTransitionMatchingResult(activeRun, "AVAILABLE", "LINKED"), false);
  assert.equal(canTransitionMatchingResult(activeRun, "SELECTED", "LINKED"), true);
  assert.equal(canTransitionMatchingResult({ ...activeRun, isPaused: true }, "AVAILABLE", "SELECTED"), false);
  assert.equal(canTransitionMatchingResult({ status: "CLOSED", isPaused: false }, "SELECTED", "LINKED"), false);
});
