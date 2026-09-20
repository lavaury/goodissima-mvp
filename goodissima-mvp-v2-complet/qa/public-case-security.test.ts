import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readPublicCaseRequest, validateExpectedAnswerCount } from "../lib/public-case-contract.ts";
import { getPublicRequestSource, normalizePublicRequestSource, pseudonymizePublicRequestSource } from "../lib/public-request-source.ts";
import { loadTestModule } from "./helpers/load-test-module.ts";

const jsonRequest = (body: unknown) => new Request("https://example.test/api/cases", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

test("public request source accepts only a single trusted hop and normalizes IP families", () => {
  assert.equal(getPublicRequestSource(new Headers({ "x-vercel-forwarded-for": "2001:0db8::1" })), "[2001:db8::1]".slice(1, -1));
  assert.equal(getPublicRequestSource(new Headers({ "x-vercel-forwarded-for": "203.0.113.4", "x-forwarded-for": "198.51.100.2" })), "203.0.113.4");
  assert.equal(getPublicRequestSource(new Headers({ "x-forwarded-for": "203.0.113.4, 10.0.0.1" })), "unknown");
  assert.equal(normalizePublicRequestSource("203.0.113.4:443"), "203.0.113.4");
});

test("source HMAC is deterministic, bounded and never contains the raw IP", () => {
  const secret = "a".repeat(32);
  const first = pseudonymizePublicRequestSource("203.0.113.4", secret);
  assert.equal(first, pseudonymizePublicRequestSource("203.0.113.4", secret));
  assert.equal(first.length, 32);
  assert.ok(!first.includes("203.0.113.4"));
  assert.throws(() => pseudonymizePublicRequestSource("unknown", ""), /SECRET_UNAVAILABLE/);
  assert.throws(() => pseudonymizePublicRequestSource("unknown", "short"), /SECRET_UNAVAILABLE/);
});

test("public case contract accepts normal Opportunity, Simple Link and legacy shapes", async () => {
  for (const body of [
    { gLinkId: "opportunity", message: "Bonjour" },
    { gLinkId: "simple", candidateName: "", answers: { besoin: "Conseil", notificationOptIn: false }, formTemplateId: "form" },
    { gLinkId: "legacy", candidateEmail: "a@example.test", documentName: "note.pdf", documentUrl: "storage/path" },
  ]) assert.equal((await readPublicCaseRequest(jsonRequest(body))).ok, true);
});

test("public case contract rejects oversized and unexpected payloads", async () => {
  const cases = [
    [{ gLinkId: "x", message: "x".repeat(2001) }, "message_too_long"],
    [{ gLinkId: "x", answers: Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`f${index}`, "x"])) }, "answers_too_many"],
    [{ gLinkId: "x", answers: { field: { nested: true } } }, "answer_value_invalid"],
    [{ gLinkId: "x", ownerId: "attacker" }, "unexpected_field"],
    [{ gLinkId: "x", documentName: "orphan" }, "document_reference_incomplete"],
  ] as const;
  for (const [body, reason] of cases) {
    const result = await readPublicCaseRequest(jsonRequest(body));
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(result.reasons, [reason]);
  }
  const huge = await readPublicCaseRequest(jsonRequest({ gLinkId: "x", answers: { a: "x".repeat(65 * 1024) } }));
  assert.equal(huge.ok, false);
  if (!huge.ok) assert.equal(huge.status, 413);
  assert.equal(validateExpectedAnswerCount({ answers: { a: 1, b: 2 } }, 1), false);
});

test("atomic UPSERT remains the sole authority under concurrent increments", async () => {
  const file = "lib/rate-limit-bucket.ts";
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(source, /ON CONFLICT/);
  assert.match(source, /"count"\s*=\s*"PublicRateLimitBucket"\."count"\s*\+\s*1/);
  assert.doesNotMatch(source, /findUnique|findFirst/);

  let count = 0;
  const client = {
    $queryRaw: async () => [{ count: ++count }],
    $executeRaw: async () => 0,
  };
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values });
  const module = loadTestModule<any>(file, {
    "@prisma/client": { Prisma: { sql } },
  });
  const results = await Promise.all(Array.from({ length: 100 }, () =>
    module.consumeRateLimitBucket(client, { dimension: "SOURCE_10_MIN", keyHash: "hash", windowSeconds: 600, limit: 100 }, new Date("2026-09-13T12:00:00Z")),
  ));
  assert.equal(count, 100);
  assert.deepEqual(results.map((item: { count: number }) => item.count), Array.from({ length: 100 }, (_, index) => index + 1));
});

test("route defines uniform 429, Retry-After and fail-closed 503 before business writes", () => {
  const source = readFileSync(new URL("../app/api/cases/route.ts", import.meta.url), "utf8");
  assert.match(source, /TOO_MANY_REQUESTS/);
  assert.match(source, /"Retry-After"/);
  assert.match(source, /RATE_LIMIT_UNAVAILABLE/);
  assert.ok(source.indexOf("checkPublicCaseCreationLimit") < source.indexOf("tx.relationCase.create"));
  for (const forbidden of ["candidateEmail", "messageBody", "candidateAccessToken"]) {
    assert.doesNotMatch(source.match(/public_case_limit_(?:allowed|throttled|unavailable)[^\n]*/g)?.join("\n") ?? "", new RegExp(forbidden));
  }
});

test("route returns uniform 429 and fail-closed 503 before reading a GLink", async () => {
  const file = "app/api/cases/route.ts";
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const imports = Object.fromEntries((await import("typescript")).default.preProcessFile(source).importedFiles.map((item) => [item.fileName, {}]));
  let gLinkReads = 0;
  const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
  const base = {
    ...imports,
    "next/server": { NextResponse: { json } },
    "@/lib/prisma": { prisma: { gLink: { findUnique: async () => { gLinkReads++; return null; } } } },
    "@/lib/public-case-contract": { readPublicCaseRequest: async () => ({ ok: true, body: { gLinkId: "link" } }), validateExpectedAnswerCount: () => true },
    "@/lib/public-case-idempotency": { readPublicCaseIdempotencyKey: () => ({ ok: true, key: null }) },
    "@/lib/public-request-source": { getPublicRequestSource: () => "unknown", pseudonymizePublicRequestSource: () => "source-hash", pseudonymizePublicRateLimitKey: () => "target-hash" },
    "@/lib/public-case-rate-limit": { publicCaseSourceRateLimitEntries: () => [], publicCaseTargetRateLimitEntries: () => [] },
  };
  const request = { headers: new Headers() } as Request;

  const throttled = loadTestModule<any>(file, { ...base, "@/lib/public-case-rate-limit": { ...base["@/lib/public-case-rate-limit"], checkPublicCaseCreationLimit: async () => ({ allowed: false, retryAfterSeconds: 600, dimension: "SOURCE_10_MIN" }) } }, { console: { warn() {}, error() {}, info() {} } });
  const response429 = await throttled.POST(request);
  assert.equal(response429.status, 429);
  assert.equal(response429.headers.get("Retry-After"), "600");
  assert.deepEqual(await response429.json(), { error: "Trop de tentatives ont été effectuées. Réessayez dans quelques instants.", code: "TOO_MANY_REQUESTS" });

  const unavailable = loadTestModule<any>(file, { ...base, "@/lib/public-case-rate-limit": { ...base["@/lib/public-case-rate-limit"], checkPublicCaseCreationLimit: async () => { throw new Error("db unavailable"); } } }, { console: { warn() {}, error() {}, info() {} } });
  const response503 = await unavailable.POST(request);
  assert.equal(response503.status, 503);
  assert.equal(response503.headers.get("Retry-After"), "60");

  const missingSecret = loadTestModule<any>(file, {
    ...base,
    "@/lib/public-request-source": { ...base["@/lib/public-request-source"], pseudonymizePublicRequestSource: () => { throw new Error("RATE_LIMIT_SECRET_UNAVAILABLE"); } },
    "@/lib/public-case-rate-limit": { ...base["@/lib/public-case-rate-limit"], checkPublicCaseCreationLimit: async () => ({ allowed: true }) },
  }, { console: { warn() {}, error() {}, info() {} } });
  const responseMissingSecret = await missingSecret.POST(request);
  assert.equal(responseMissingSecret.status, 503);
  assert.deepEqual(await responseMissingSecret.json(), { error: "Service temporairement indisponible.", code: "RATE_LIMIT_UNAVAILABLE" });
  assert.equal(gLinkReads, 0);
});
