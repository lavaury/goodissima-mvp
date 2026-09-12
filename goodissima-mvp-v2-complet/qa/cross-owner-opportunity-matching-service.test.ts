import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { MatchingResultRecord, MatchingRunRecord } from "../lib/matching-contracts.ts";
import { CrossOwnerOpportunityMatchingService, PrismaMatchableOpportunitySourceRepository } from "../lib/matching/cross-owner-opportunity-matching-service.ts";
import type { MatchCandidateV1 } from "../lib/matching/cross-owner-opportunity-candidate-repository.ts";
import { buildOpportunityRulesV1 } from "../lib/opportunities/opportunity-projection.ts";
import { buildMatchableOpportunityProjection } from "../lib/opportunities/matching/matchable-projection.ts";

function rules(type: "OFFER" | "NEED", subject: string, location: string, days: Array<"MONDAY" | "TUESDAY" | "THURSDAY">, from: string, to: string, matchingEnabled = true) {
  return buildOpportunityRulesV1({}, { type, matchingEnabled, criteria: { subject, locations: [location], availability: { days, timeFrom: from, timeTo: to }, terms: [type === "OFFER" ? "PRIVATE_BOB_TERM" : "Recherche"] } });
}

function run(status: MatchingRunRecord["status"]): MatchingRunRecord {
  const now = new Date("2026-09-12T10:00:00.000Z");
  return { id: "cross-run", gLinkId: "alice-need", ownerId: "alice", status, isPaused: false, engineVersion: "opportunity-structured-v1", criteriaSnapshot: {}, startedAt: status === "RUNNING" ? now : null, completedAt: status === "RESULTS_AVAILABLE" ? now : null, failedAt: null, pausedAt: null, closedAt: null, failureCode: null, idempotencyKey: null, createdAt: now, updatedAt: now };
}

function persisted(target: string, explanation: unknown, rank: number): MatchingResultRecord {
  const now = new Date("2026-09-12T10:00:00.000Z");
  return { id: `result-${rank}`, runId: "cross-run", targetGLinkId: target, status: "AVAILABLE", explanation, internalRank: rank, selectedAt: null, dismissedAt: null, linkedAt: null, relationCaseId: null, createdAt: now, updatedAt: now };
}

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, nested]) => { keys.add(key.toLowerCase()); collectKeys(nested, keys); });
  return keys;
}

function setup(candidateRules: unknown[], persistFilter: (target: string) => boolean = () => true, ownerRefs: string[] = []) {
  const sourceProjection = buildMatchableOpportunityProjection({ rules: rules("NEED", "baby-sitter", "Beauvais", ["TUESDAY", "THURSDAY"], "18:00", "20:00") })!;
  const candidates: MatchCandidateV1[] = candidateRules.map((value, index) => ({ internalTargetRef: `target-${index}`, internalOwnerRef: ownerRefs[index] ?? `owner-${index}`, projection: buildMatchableOpportunityProjection({ rules: value })! }));
  const calls = { prepared: [] as any[], discovered: [] as any[], persisted: [] as any[], failed: 0 };
  const lifecycle = {
    async prepareMatchingRun(input: any) { calls.prepared.push(input); return run("PREPARED"); },
    async startMatchingRun() { return run("RUNNING"); },
    async createCrossOwnerMatchingResults(input: any) {
      calls.persisted.push(input);
      return input.results.filter((item: any) => persistFilter(item.internalTargetRef)).map((item: any, index: number) => persisted(item.internalTargetRef, item.explanation, index));
    },
    async markMatchingResultsAvailable() { return run("RESULTS_AVAILABLE"); },
    async failMatchingRun() { calls.failed += 1; return run("FAILED"); },
  };
  const service = new CrossOwnerOpportunityMatchingService(
    { async findEligibleSourceForOwner() { return { internalSourceRef: "alice-need", internalOwnerRef: "alice", projection: sourceProjection }; } },
    { async listEligibleCandidates(input) { calls.discovered.push(input); return candidates; } },
    lifecycle,
  );
  return { service, calls };
}

test("internal pipeline discovers, ranks, persists and returns only the safe B1 view", async () => {
  const { service, calls } = setup([
    rules("OFFER", "garde d’enfants", "Beauvais", ["TUESDAY", "THURSDAY"], "17:00", "21:00"),
    rules("OFFER", "garde d’enfants", "Beauvais", ["TUESDAY"], "18:00", "20:00"),
  ]);
  const output = await service.execute({ ownerId: "alice", sourceId: "alice-need" });
  assert.equal(output.persistedCount, 2);
  assert.deepEqual(calls.discovered[0], { sourceId: "alice-need", sourceOwnerId: "alice", complementaryType: "OFFER", limit: 80 });
  assert.equal(calls.prepared[0].criteriaSnapshot.scope, "CROSS_OWNER_V1");
  assert.equal(calls.persisted[0].results.length, 2);
  assert.equal(calls.persisted[0].results[0].expectedProjection.opportunityType, "OFFER");
  const json = JSON.stringify(output);
  for (const value of ["target-0", "target-1", "owner-0", "owner-1", "PRIVATE_BOB_TERM", "Beauvais", "17:00", "21:00", "similarity", "internalRank", "targetGLinkId"]) assert.equal(json.includes(value), false, value);
  assert.deepEqual(Object.keys(output), ["runId", "persistedCount", "results"]);
  const keys = collectKeys(output);
  for (const key of ["targetGLinkId", "ownerId", "internalOwnerRef", "internalTargetRef", "internalRank", "score", "similarity", "title", "description", "slug", "email", "phone"]) assert.equal(keys.has(key.toLowerCase()), false, key);
  assert.equal(output.results[0]?.label, "OFFER_MATCH");
});

test("hard incompatibility produces a successful empty run", async () => {
  const { service, calls } = setup([rules("OFFER", "garde d’enfants", "Lille", ["MONDAY"], "08:00", "12:00")]);
  const output = await service.execute({ ownerId: "alice", sourceId: "alice-need" });
  assert.equal(output.persistedCount, 0);
  assert.deepEqual(output.results, []);
  assert.deepEqual(calls.persisted[0].results, []);
  assert.equal(calls.failed, 0);
});

test("defense in depth excludes a same-owner candidate and B3 partial success is reflected safely", async () => {
  const compatible = rules("OFFER", "garde d’enfants", "Beauvais", ["TUESDAY"], "18:00", "20:00");
  const { service, calls } = setup([compatible, compatible, compatible], (target) => target === "target-1", ["alice", "owner-1", "owner-2"]);
  const originalDiscovery = calls.discovered;
  const output = await service.execute({ ownerId: "alice", sourceId: "alice-need" });
  assert.equal(output.persistedCount, 1);
  assert.equal(output.results.length, 1);
  assert.equal(originalDiscovery.length, 1);
});

test("ineligible source is rejected before run creation or discovery", async () => {
  let prepared = false;
  let discovered = false;
  const service = new CrossOwnerOpportunityMatchingService(
    { async findEligibleSourceForOwner() { return null; } },
    { async listEligibleCandidates() { discovered = true; return []; } },
    { async prepareMatchingRun() { prepared = true; return run("PREPARED"); }, async startMatchingRun() { return run("RUNNING"); }, async createCrossOwnerMatchingResults() { return []; }, async markMatchingResultsAvailable() { return run("RESULTS_AVAILABLE"); }, async failMatchingRun() { return run("FAILED"); } },
  );
  await assert.rejects(service.execute({ ownerId: "alice", sourceId: "alice-need" }), { message: "MATCHING_SOURCE_NOT_FOUND" });
  assert.equal(prepared, false);
  assert.equal(discovered, false);
});

test("source repository is owner-scoped, minimal and projects immediately", async () => {
  let query: any;
  const raw = { id: "source", ownerId: "alice", status: "ACTIVE", rules: rules("NEED", "Recherche", "Beauvais", ["TUESDAY"], "18:00", "20:00"), title: "PRIVATE_TITLE", slug: "PRIVATE_SLUG" };
  const repository = new PrismaMatchableOpportunitySourceRepository({ gLink: { findFirst: async (args: any) => { query = args; return raw; } } } as any);
  const result = await repository.findEligibleSourceForOwner("alice", "source");
  assert.deepEqual(query.select, { id: true, ownerId: true, status: true, rules: true });
  assert.deepEqual(query.where, { id: "source", ownerId: "alice", status: "ACTIVE" });
  assert.equal(JSON.stringify(result).includes("PRIVATE_TITLE"), false);
  assert.equal(JSON.stringify(result).includes("PRIVATE_SLUG"), false);
});

test("source repository rejects absent or revoked consent", async () => {
  for (const sourceRules of [
    buildOpportunityRulesV1({}, { type: "NEED", criteria: { subject: "Recherche" } }),
    rules("NEED", "Recherche", "Beauvais", ["TUESDAY"], "18:00", "20:00", false),
  ]) {
    const repository = new PrismaMatchableOpportunitySourceRepository({ gLink: { findFirst: async () => ({ id: "source", ownerId: "alice", status: "ACTIVE", rules: sourceRules }) } } as any);
    assert.equal(await repository.findEligibleSourceForOwner("alice", "source"), null);
  }
});

test("no public API imports or invokes the internal cross-owner orchestrator", () => {
  const route = readFileSync(new URL("../app/api/links/[linkId]/matching/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /CrossOwnerOpportunityMatchingService|createCrossOwnerMatchingResults|CROSS_OWNER_V1/);
});
