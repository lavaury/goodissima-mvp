import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { consumeRateLimitBucket } from "../lib/rate-limit-bucket.ts";
import {
  isCrossOwnerMatchingEnabled,
  MATCHING_CACHE_TTL_MS,
  MATCHING_RATE_LIMITS,
  consumeMatchingRateLimits,
  matchingCriteriaFingerprintHash,
  matchingRateLimitEntries,
} from "../lib/matching/matching-safety.ts";
import {
  acquireMatchingExecutionLease,
  findReusableMatchingRun,
  releaseMatchingExecutionLease,
} from "../lib/matching/matching-safety-repository.ts";
import type { MatchableOpportunityProjectionV1 } from "../lib/opportunities/matching/matchable-projection.ts";

const projection: MatchableOpportunityProjectionV1 = {
  schemaVersion: 1,
  opportunityType: "NEED",
  subject: "Garde d'enfants",
  category: "Services",
  locations: ["Beauvais"],
};
const secret = "s".repeat(32);

test("cross-owner feature flag is server-side, OFF by default and explicitly enabled", () => {
  assert.equal(isCrossOwnerMatchingEnabled({}), false);
  assert.equal(isCrossOwnerMatchingEnabled({ FEATURE_CROSS_OWNER_MATCHING: "false" }), false);
  assert.equal(isCrossOwnerMatchingEnabled({ FEATURE_CROSS_OWNER_MATCHING: "true" }), true);
});

test("HMAC fingerprint is stable, versioned and never returns canonical criteria", () => {
  const input = { projection, engineVersion: "engine-v1", comparatorPolicyVersion: "policy-v1" };
  const first = matchingCriteriaFingerprintHash(input, secret);
  assert.equal(first, matchingCriteriaFingerprintHash({ ...input, projection: { category: "Services", subject: "Garde d'enfants", opportunityType: "NEED", locations: ["Beauvais"], schemaVersion: 1 } }, secret));
  assert.equal(first.length, 64);
  assert.ok(!first.includes("Beauvais"));
  assert.notEqual(first, matchingCriteriaFingerprintHash({ ...input, engineVersion: "engine-v2" }, secret));
  assert.notEqual(first, matchingCriteriaFingerprintHash({ ...input, comparatorPolicyVersion: "policy-v2" }, secret));
  assert.notEqual(first, matchingCriteriaFingerprintHash({ ...input, projection: { ...projection, locations: ["Lille"] } }, secret));
  const source = readFileSync(new URL("../lib/matching/matching-safety.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.|logger\.|\.log\s*\(/);
});

test("matching quotas are separate, centralized and HMAC-scoped", () => {
  assert.deepEqual(MATCHING_RATE_LIMITS, {
    MATCH_USER_10M: { windowSeconds: 600, limit: 5 }, MATCH_USER_24H: { windowSeconds: 86400, limit: 30 },
    MATCH_OWNER_10M: { windowSeconds: 600, limit: 15 }, MATCH_OWNER_24H: { windowSeconds: 86400, limit: 75 },
    MATCH_OPPORTUNITY_10M: { windowSeconds: 600, limit: 3 }, MATCH_OPPORTUNITY_24H: { windowSeconds: 86400, limit: 20 },
  });
  const entries = matchingRateLimitEntries({ userId: "user-private", ownerId: "owner-private", opportunityId: "opportunity-private" }, secret);
  assert.equal(entries.length, 6);
  assert.equal(new Set(entries.map((entry) => entry.dimension)).size, 6);
  assert.doesNotMatch(JSON.stringify(entries), /user-private|owner-private|opportunity-private/);
});

test("user, owner and Opportunity quota failures remain distinct and limiter errors fail closed", async () => {
  const entries = matchingRateLimitEntries({ userId: "user", ownerId: "owner", opportunityId: "opportunity" }, secret);
  for (const [failureIndex, expectedDimension] of [[0, "MATCH_USER_10M"], [2, "MATCH_OWNER_10M"], [4, "MATCH_OPPORTUNITY_10M"]] as const) {
    let call = 0;
    const client = {
      $queryRaw: async () => [{ count: call++ === failureIndex ? 1_000 : 1 }],
      $executeRaw: async () => 0,
    } as any;
    const result = await consumeMatchingRateLimits(client, entries, new Date("2026-09-14T12:00:00Z"));
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.dimension, expectedDimension);
  }
  const unavailable = { $queryRaw: async () => { throw new Error("database unavailable"); }, $executeRaw: async () => 0 } as any;
  await assert.rejects(consumeMatchingRateLimits(unavailable, entries), /database unavailable/);
});

test("generic rate-limit bucket is atomic and resets with the next window", async () => {
  let count = 0;
  const client = { $queryRaw: async () => [{ count: ++count }], $executeRaw: async () => 0 } as any;
  const input = { dimension: "MATCH_USER_10M", keyHash: "hash", windowSeconds: 600, limit: 5 };
  const results = await Promise.all(Array.from({ length: 6 }, () => consumeRateLimitBucket(client, input, new Date("2026-09-14T12:01:00Z"))));
  assert.equal(results.filter((result) => result.allowed).length, 5);
  assert.equal(results[5].allowed, false);
  count = 0;
  assert.equal((await consumeRateLimitBucket(client, input, new Date("2026-09-14T12:11:00Z"))).allowed, true);
  const source = readFileSync(new URL("../lib/rate-limit-bucket.ts", import.meta.url), "utf8");
  assert.match(source, /ON CONFLICT/);
  assert.match(source, /"count"\s*=\s*"PublicRateLimitBucket"\."count"\s*\+\s*1/);
});

test("one database lease wins and an expired lease can be reacquired", async () => {
  let active = false;
  const client = {
    $queryRaw: async () => active ? [] : (active = true, [{ id: "lease", expiresAt: new Date("2026-09-14T12:02:00Z") }]),
    $executeRaw: async () => 0,
    matchingRun: {},
  } as any;
  const input = { ownerId: "owner", gLinkId: "link", criteriaFingerprintHash: "hash", now: new Date("2026-09-14T12:00:00Z") };
  const leases = await Promise.all(Array.from({ length: 10 }, () => acquireMatchingExecutionLease(client, input)));
  assert.equal(leases.filter((lease) => lease.acquired).length, 1);
  active = false;
  assert.equal((await acquireMatchingExecutionLease(client, { ...input, now: new Date("2026-09-14T12:03:00Z") })).acquired, true);
  const source = readFileSync(new URL("../lib/matching/matching-safety-repository.ts", import.meta.url), "utf8");
  assert.match(source, /ON CONFLICT/);
  assert.match(source, /"expiresAt"\s*<=/);
  assert.match(source, /WHERE "id" = \$\{input\.leaseId\}/);
  await releaseMatchingExecutionLease(client, { leaseId: "lease", ownerId: "owner", gLinkId: "link", criteriaFingerprintHash: "hash" });
});

test("recent completed cache is selected and expired cache is ignored by the query", async () => {
  const calls: any[] = [];
  const client = { matchingRun: { findFirst: async (query: any) => { calls.push(query); return null; } } } as any;
  const now = new Date("2026-09-14T12:00:00Z");
  await findReusableMatchingRun(client, { ownerId: "owner", gLinkId: "link", criteriaFingerprintHash: "hash", now });
  assert.deepEqual(calls[0].where, {
    ownerId: "owner", gLinkId: "link", criteriaFingerprintHash: "hash", status: "RESULTS_AVAILABLE", cacheValidUntil: { gt: now },
  });
  assert.equal(MATCHING_CACHE_TTL_MS, 600_000);
});

test("new persistence fields contain hashes, cache metadata and no personal data", () => {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const run = schema.match(/model MatchingRun \{[\s\S]*?\n\}/)?.[0] ?? "";
  const lease = schema.match(/model MatchingExecutionLease \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(run, /criteriaFingerprintHash/);
  assert.match(run, /cacheValidUntil/);
  assert.match(lease, /criteriaFingerprintHash/);
  for (const forbidden of ["email", "name", "criteria Json", "projection", "score", "explanation"]) assert.doesNotMatch(`${run}\n${lease}`, new RegExp(forbidden, "i"));
});
