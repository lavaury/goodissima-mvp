import assert from "node:assert/strict";
import test, { after } from "node:test";
import type { MatchingResultRecord, MatchingRunRecord } from "../lib/matching-contracts.ts";
import { CrossOwnerOpportunityMatchingService, crossOwnerMatchingPublicFailure } from "../lib/matching/cross-owner-opportunity-matching-service.ts";
import { MatchingDomainError } from "../lib/matching-contracts.ts";
import { buildOpportunityRulesV1 } from "../lib/opportunities/opportunity-projection.ts";
import { buildMatchableOpportunityProjection } from "../lib/opportunities/matching/matchable-projection.ts";

const originalRateLimitSecret = process.env.RATE_LIMIT_HMAC_SECRET;
process.env.RATE_LIMIT_HMAC_SECRET = "cross-owner-hardening-secret-at-least-32-characters";
after(() => {
  if (originalRateLimitSecret === undefined) delete process.env.RATE_LIMIT_HMAC_SECRET;
  else process.env.RATE_LIMIT_HMAC_SECRET = originalRateLimitSecret;
});
const now = new Date("2026-09-14T12:00:00Z");
const projection = buildMatchableOpportunityProjection({ rules: buildOpportunityRulesV1({}, { type: "NEED", matchingEnabled: true, criteria: { subject: "Garde", locations: ["Beauvais"] } }) })!;
const run = (status: MatchingRunRecord["status"]): MatchingRunRecord => ({ id: "cached-run", gLinkId: "source", ownerId: "owner", status, isPaused: false, engineVersion: "opportunity-structured-v1", criteriaSnapshot: { scope: "CROSS_OWNER_V1", sourceType: "NEED" }, startedAt: now, completedAt: now, failedAt: null, pausedAt: null, closedAt: null, failureCode: null, idempotencyKey: null, criteriaFingerprintHash: "hash", cacheValidUntil: new Date(now.getTime() + 600_000), createdAt: now, updatedAt: now });
const result: MatchingResultRecord = { id: "opaque-result", runId: "cached-run", targetGLinkId: "private-target", status: "AVAILABLE", explanation: { band: "GOOD" }, internalRank: 0, selectedAt: null, dismissedAt: null, linkedAt: null, relationCaseId: null, createdAt: now, updatedAt: now };

function fixture(overrides: { allowed?: boolean; cached?: boolean; acquired?: boolean; limiterError?: boolean; invalidated?: boolean; preparedStatus?: MatchingRunRecord["status"] } = {}) {
  const calls = { prepared: 0, started: 0, scanned: 0, released: 0 };
  const metrics: unknown[] = [];
  const lifecycle = {
    async prepareMatchingRun() { calls.prepared++; return run(overrides.preparedStatus ?? "PREPARED"); },
    async startMatchingRun() { calls.started++; return run("RUNNING"); },
    async createCrossOwnerMatchingResults() { return []; },
    async markMatchingResultsAvailable() { return run("RESULTS_AVAILABLE"); },
    async failMatchingRun() { return run("FAILED"); },
    async getRevalidatedCrossOwnerRunWithResults() { return { run: run("RESULTS_AVAILABLE"), results: overrides.invalidated ? [] : [result], invalidatedResultIds: overrides.invalidated ? [result.id] : [] }; },
    async transitionCrossOwnerMatchingResult() { return { ...result, status: "SELECTED" as const, selectedAt: now }; },
  };
  const safety = {
    async consume() { if (overrides.limiterError) throw new Error("down"); return { allowed: overrides.allowed !== false } as { allowed: true } | { allowed: false }; },
    async findReusable() { return overrides.cached ? run("RESULTS_AVAILABLE") : null; },
    async acquire() { return overrides.acquired !== false ? { acquired: true as const, leaseId: "lease-owned" } : { acquired: false as const }; },
    async release() { calls.released++; },
  };
  const service = new CrossOwnerOpportunityMatchingService(
    { async findEligibleSourceForOwner() { return { internalSourceRef: "source", internalOwnerRef: "owner", projection }; } },
    { async listEligibleCandidates() { calls.scanned++; return []; } }, lifecycle, () => true, safety, (event) => metrics.push(event), () => now,
  );
  return { service, calls, metrics, lifecycle, safety };
}

test("completed cache replay returns the same run without persistence, scan or restart", async () => {
  const { service, calls } = fixture({ cached: true });
  const output = await service.execute({ userId: "user", ownerId: "owner", sourceId: "source", idempotencyKey: "new-key" });
  assert.equal(output.runId, "cached-run");
  assert.equal(output.results.length, 1);
  assert.deepEqual(calls, { prepared: 0, started: 0, scanned: 0, released: 0 });
});

test("a RESULTS_AVAILABLE idempotency replay never restarts the completed run", async () => {
  const { service, calls } = fixture({ preparedStatus: "RESULTS_AVAILABLE" });
  const output = await service.execute({ ownerId: "owner", sourceId: "source", idempotencyKey: "same-key" });
  assert.equal(output.runId, "cached-run");
  assert.equal(calls.prepared, 1);
  assert.equal(calls.started, 0);
  assert.equal(calls.scanned, 0);
  assert.equal(calls.released, 1);
});

test("quota rejection and limiter failure happen before run creation", async () => {
  const throttled = fixture({ allowed: false });
  await assert.rejects(throttled.service.execute({ ownerId: "owner", sourceId: "source" }), { message: "MATCHING_THROTTLED" });
  assert.equal(throttled.calls.prepared, 0);
  const unavailable = fixture({ limiterError: true });
  await assert.rejects(unavailable.service.execute({ ownerId: "owner", sourceId: "source" }), { message: "MATCHING_PROTECTION_UNAVAILABLE" });
  assert.equal(unavailable.calls.prepared, 0);
  assert.deepEqual(crossOwnerMatchingPublicFailure(new MatchingDomainError("MATCHING_THROTTLED")), { status: 429, body: { error: "MATCHING_THROTTLED" } });
  assert.deepEqual(crossOwnerMatchingPublicFailure(new MatchingDomainError("MATCHING_PROTECTION_UNAVAILABLE")), { status: 503, body: { error: "MATCHING_UNAVAILABLE" } });
  assert.deepEqual(crossOwnerMatchingPublicFailure(new MatchingDomainError("MATCHING_SOURCE_NOT_FOUND")), { status: 404, body: { error: "MATCHING_UNAVAILABLE" } });
});

test("an active lease makes concurrent work retryable without a second calculation", async () => {
  const { service, calls } = fixture({ acquired: false });
  await assert.rejects(service.execute({ ownerId: "owner", sourceId: "source" }), { message: "MATCHING_EXECUTION_IN_PROGRESS" });
  assert.equal(calls.prepared, 0);
  assert.equal(calls.scanned, 0);
});

test("an invalidated cached result is ignored and aggregate metrics contain no identifiers", async () => {
  const { service, calls, metrics } = fixture({ cached: true, invalidated: true });
  await service.execute({ userId: "private-user", ownerId: "owner", sourceId: "source" });
  assert.equal(calls.prepared, 1);
  assert.equal(calls.started, 1);
  assert.equal(calls.scanned, 1);
  assert.equal(calls.released, 1);
  const serialized = JSON.stringify(metrics);
  assert.match(serialized, /requested|invalidated_result|executed/);
  assert.doesNotMatch(serialized, /private-user|owner|source|private-target|criteria|fingerprint|score|candidatesExamined|candidateCount/);
});

test("flag also blocks historical reads and decisions", async () => {
  const base = fixture();
  const disabled = new CrossOwnerOpportunityMatchingService(
    { async findEligibleSourceForOwner() { return { internalSourceRef: "source", internalOwnerRef: "owner", projection }; } },
    { async listEligibleCandidates() { return []; } },
    base.lifecycle,
    () => false,
    base.safety,
  );
  await assert.rejects(disabled.read({ ownerId: "owner", runId: "cached-run" }), { message: "MATCHING_DISABLED" });
  await assert.rejects(disabled.decide({ ownerId: "owner", runId: "cached-run", resultId: "opaque-result", decision: "SELECTED" }), { message: "MATCHING_DISABLED" });
});
