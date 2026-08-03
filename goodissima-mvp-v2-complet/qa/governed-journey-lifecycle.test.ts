import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findGovernedJourneyTransition,
  governedJourneyLifecycleDates,
  governedJourneyTransitions,
  isGovernedJourneyCommandIdempotent,
  normalizeGovernedJourneyReason,
} from "../lib/governed-journey/lifecycle.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = read("prisma/schema.prisma");
const enumMigration = read("prisma/migrations/20260806120000_add_governed_journey_lifecycle/migration.sql");
const contractsMigration = read("prisma/migrations/20260806121000_add_governed_journey_lifecycle_contracts/migration.sql");
const service = read("lib/governed-journey/service.ts");

test("the lifecycle exposes exactly the seven authorized transitions", () => {
  assert.deepEqual(governedJourneyTransitions.map(({ command, from, to, eventType }) => [command, from, to, eventType]), [
    ["ACTIVATE", "DRAFT", "ACTIVE", "ACTIVATED"],
    ["SUSPEND", "ACTIVE", "SUSPENDED", "SUSPENDED"],
    ["RESUME", "SUSPENDED", "ACTIVE", "RESUMED"],
    ["CLOSE", "ACTIVE", "CLOSED", "CLOSED"],
    ["CANCEL", "DRAFT", "CANCELLED", "CANCELLED"],
    ["CANCEL", "ACTIVE", "CANCELLED", "CANCELLED"],
    ["CANCEL", "SUSPENDED", "CANCELLED", "CANCELLED"],
  ]);
});

test("all absent transitions are forbidden and terminal states have no exits", () => {
  const statuses = ["DRAFT", "ACTIVE", "SUSPENDED", "CLOSED", "CANCELLED"] as const;
  const commands = ["ACTIVATE", "SUSPEND", "RESUME", "CLOSE", "CANCEL"] as const;
  for (const status of statuses) for (const command of commands) {
    const expected = governedJourneyTransitions.some((transition) => transition.from === status && transition.command === command);
    assert.equal(Boolean(findGovernedJourneyTransition(status, command)), expected, `${status} / ${command}`);
  }
  assert.equal(findGovernedJourneyTransition("SUSPENDED", "CLOSE"), null);
  assert.equal(governedJourneyTransitions.some(({ from }) => from === "CLOSED" || from === "CANCELLED"), false);
});

test("repeated target commands are idempotent", () => {
  assert.equal(isGovernedJourneyCommandIdempotent("ACTIVE", "ACTIVATE"), true);
  assert.equal(isGovernedJourneyCommandIdempotent("SUSPENDED", "SUSPEND"), true);
  assert.equal(isGovernedJourneyCommandIdempotent("CANCELLED", "CANCEL"), true);
  assert.equal(isGovernedJourneyCommandIdempotent("CLOSED", "RESUME"), false);
});

test("suspension and cancellation require a trimmed bounded reason", () => {
  assert.deepEqual(normalizeGovernedJourneyReason("  motif humain  ", true), { ok: true, value: "motif humain" });
  assert.deepEqual(normalizeGovernedJourneyReason("  ", true), { ok: false, code: "REASON_REQUIRED" });
  assert.deepEqual(normalizeGovernedJourneyReason("x".repeat(501), false), { ok: false, code: "INVALID_INPUT" });
  assert.deepEqual(normalizeGovernedJourneyReason(undefined, false), { ok: true, value: null });
});

test("lifecycle dates preserve the first start and clear suspension deterministically", () => {
  const firstStart = new Date("2026-08-04T08:00:00.000Z");
  const now = new Date("2026-08-04T09:00:00.000Z");
  assert.deepEqual(governedJourneyLifecycleDates("ACTIVATE", { startedAt: null }, now), { startedAt: now, suspendedAt: null });
  assert.deepEqual(governedJourneyLifecycleDates("ACTIVATE", { startedAt: firstStart }, now), { startedAt: firstStart, suspendedAt: null });
  assert.deepEqual(governedJourneyLifecycleDates("SUSPEND", { startedAt: firstStart }, now), { suspendedAt: now });
  assert.deepEqual(governedJourneyLifecycleDates("RESUME", { startedAt: firstStart }, now), { suspendedAt: null });
  assert.deepEqual(governedJourneyLifecycleDates("CLOSE", { startedAt: firstStart }, now), { closedAt: now, suspendedAt: null });
  assert.deepEqual(governedJourneyLifecycleDates("CANCEL", { startedAt: firstStart }, now), { cancelledAt: now, suspendedAt: null });
});

test("Prisma records optimistic versioning and a same-authority event sequence", () => {
  assert.match(schema, /version Int @default\(1\)/);
  assert.match(schema, /@@unique\(\[governedJourneyId, sequence\]\)/);
  assert.match(schema, /fields: \[governedJourneyId, relationCaseId, authorityUserId\], references: \[id, relationCaseId, authorityUserId\]/);
  assert.match(service, /tx\.governedJourney\.updateMany/);
  for (const field of ["id: journey.id", "relationCaseId: journey.relationCaseId", "authorityUserId: journey.authorityUserId", "status: transition.from", "version: input.expectedVersion"]) assert.match(service, new RegExp(field.replace(/[.]/g, "\\.")));
  assert.match(service, /version: \{ increment: 1 \}/);
  assert.match(service, /sequence: nextVersion/);
  assert.match(service, /updated\.count !== 1/);
});

test("transition and event are atomic, idempotence emits nothing, and failures are stable", () => {
  assert.match(service, /prisma\.\$transaction/);
  assert.match(service, /return \{ journey, event: undefined, changed: false as const \}/);
  assert.match(service, /tx\.governedJourneyEvent\.create/);
  assert.match(service, /VERSION_CONFLICT/);
  assert.match(service, /GOVERNED_JOURNEY_TRANSITION_FAILED/);
  assert.doesNotMatch(service, /governedJourneyEvent\.(?:update|updateMany|delete|deleteMany)/);
});

test("owner scope masks cross-owner and cross-case before authority checks", () => {
  assert.match(service, /id: input\.governedJourneyId,[\s\S]*relationCaseId: input\.relationCaseId,[\s\S]*relationCase: \{ ownerId: input\.actorUserId \}/);
  assert.match(service, /if \(!journey\) throw new GovernedJourneyInvariantError\("NOT_FOUND"\)/);
  assert.match(service, /journey\.authorityUserId !== input\.actorUserId/);
  assert.doesNotMatch(service, /governedJourneyInvitation|communicationSession|contactRequest/i);
});

test("the migration validates GJ-0 facts and protects the journal from mutation", () => {
  assert.match(contractsMigration, /each journey must have exactly one CREATED event/);
  assert.match(contractsMigration, /CREATED event case or actor is inconsistent with journey authority/);
  assert.match(contractsMigration, /SET[\s\S]*"authorityUserId" = "actorUserId"[\s\S]*"toStatus" = 'DRAFT'[\s\S]*"sequence" = 1/);
  assert.match(contractsMigration, /BEFORE UPDATE OR DELETE ON "GovernedJourneyEvent"/);
  assert.match(contractsMigration, /GovernedJourneyEvent is append-only/);
  assert.doesNotMatch(contractsMigration, /INSERT INTO "GovernedJourney"/);
  assert.doesNotMatch(contractsMigration, /INSERT INTO "GovernedJourneyEvent"/);
});

test("enum values are committed in a dedicated migration before they are used", () => {
  const statements = enumMigration.split(";").map((statement) => statement.trim()).filter(Boolean);
  assert.deepEqual(statements, ["ACTIVATED", "SUSPENDED", "RESUMED", "CLOSED", "CANCELLED"].map(
    (value) => `ALTER TYPE "GovernedJourneyEventType" ADD VALUE IF NOT EXISTS '${value}'`,
  ));
  assert.doesNotMatch(enumMigration, /CHECK|ALTER TABLE|UPDATE|CREATE TRIGGER/i);
  assert.doesNotMatch(contractsMigration, /ALTER TYPE[\s\S]*ADD VALUE/i);
  assert.match(contractsMigration, /GovernedJourneyEvent_transition_check/);
  assert.match(contractsMigration, /CREATE TRIGGER "GovernedJourneyEvent_append_only"/);
  assert.ok(contractsMigration.indexOf("UPDATE \"GovernedJourneyEvent\"") < contractsMigration.indexOf("CREATE TRIGGER \"GovernedJourneyEvent_append_only\""));
});

test("SQL rejects nullable sources and sequence one for every non-CREATED event", () => {
  assert.match(contractsMigration, /"type" <> 'CREATED'\s+AND "fromStatus" IS NOT NULL\s+AND "sequence" > 1/);
  assert.match(contractsMigration, /"type" = 'ACTIVATED' AND "fromStatus" = 'DRAFT' AND "toStatus" = 'ACTIVE'/);
  assert.match(contractsMigration, /"type" = 'SUSPENDED' AND "fromStatus" = 'ACTIVE' AND "toStatus" = 'SUSPENDED'/);
});

test("SQL rejects zero and negative event sequences", () => {
  assert.match(contractsMigration, /GovernedJourneyEvent_sequence_check"\s+CHECK \("sequence" >= 1\)/);
});

test("SQL rejects whitespace-only suspension and cancellation reasons", () => {
  assert.match(contractsMigration, /GovernedJourneyEvent_reason_length_check"\s+CHECK \("reason" IS NULL OR length\(btrim\("reason"\)\) BETWEEN 1 AND 500\)/);
  assert.match(contractsMigration, /"type" = 'SUSPENDED'[\s\S]*?"reason" IS NOT NULL AND length\(btrim\("reason"\)\) BETWEEN 1 AND 500/);
  assert.match(contractsMigration, /"type" = 'CANCELLED'[\s\S]*?"reason" IS NOT NULL AND length\(btrim\("reason"\)\) BETWEEN 1 AND 500/);
});

test("GJ-1 has no memory or automatic side effect", () => {
  const implementation = `${service}\n${read("lib/governed-journey/lifecycle.ts")}\n${enumMigration}\n${contractsMigration}`;
  assert.doesNotMatch(implementation, /governedMemory|GovernedMemory|openai|mistral|embedding/i);
  assert.doesNotMatch(service, /notification|invitation|communicationSession|accessGrant/i);
});
