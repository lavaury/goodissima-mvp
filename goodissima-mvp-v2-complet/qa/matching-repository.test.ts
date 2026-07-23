import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const repository = source("lib/matching/matching-repository.ts");
const lifecycle = source("lib/matching/matching-lifecycle-service.ts");

test("repository scopes every run and result access by owner", () => {
  assert.match(repository, /findRunForOwner\(ownerId: string, runId: string\)/);
  assert.match(repository, /where: \{ id: runId, ownerId \}/);
  assert.match(repository, /where: \{ ownerId, gLinkId \}/);
  assert.match(repository, /run: \{ ownerId \}/);
  assert.match(repository, /run: \{ ownerId: input\.ownerId, status: input\.expectedRunStatus, isPaused: false \}/);
  assert.doesNotMatch(repository, /matchingRun\.findUnique\(\{\s*where:\s*\{\s*id:/);
  assert.doesNotMatch(repository, /matchingResult\.findUnique\(\{\s*where:\s*\{\s*id:/);
});

test("repository provides transactions and conditional writes", () => {
  assert.match(repository, /\$transaction/);
  assert.match(repository, /matchingRun\.updateMany/);
  assert.match(repository, /expectedStatus: MatchingRunStatus/);
  assert.match(repository, /expectedPaused: boolean/);
  assert.match(repository, /matchingResult\.updateMany/);
  assert.match(repository, /createMany/);
  assert.match(repository, /skipDuplicates: true/);
});

test("repository classifies only the MatchingRun idempotency P2002 violation", async () => {
  const {
    MatchingRunIdempotencyUniqueError,
    isMatchingRunIdempotencyUniqueError,
    isPrismaMatchingRunIdempotencyViolation,
  } = await import("../lib/matching/matching-repository.ts");

  assert.equal(isPrismaMatchingRunIdempotencyViolation({
    code: "P2002",
    meta: { target: ["ownerId", "idempotencyKey"] },
  }), true);
  assert.equal(isPrismaMatchingRunIdempotencyViolation({
    code: "P2002",
    meta: { constraint: "MatchingRun_ownerId_idempotencyKey_key" },
  }), true);
  assert.equal(isPrismaMatchingRunIdempotencyViolation({
    code: "P2002",
    meta: { target: ["id"] },
  }), false);
  assert.equal(isPrismaMatchingRunIdempotencyViolation(new Error("DATABASE_UNAVAILABLE")), false);
  assert.equal(isMatchingRunIdempotencyUniqueError(new MatchingRunIdempotencyUniqueError()), true);
  assert.equal(isMatchingRunIdempotencyUniqueError(new Error("UNIQUE")), false);
});

test("server matching layer has no automatic consequences or legacy event dependency", () => {
  const combined = `${repository}\n${lifecycle}`;
  assert.doesNotMatch(combined, /sendEmail|sendMail|notification|invitation|contact|candidateAccessToken/i);
  assert.doesNotMatch(combined, /relationCase\.(create|update)|aIEvent|AIEvent/);
  assert.doesNotMatch(combined, /app\/api|NextResponse|Request|Response/);
});

test("LINKED remains a contract-only transition in lot two", () => {
  assert.match(lifecycle, /Exclude<MatchingResultStatus, "LINKED">/);
  assert.doesNotMatch(lifecycle, /relationCaseId:\s*[^n]/);
});
