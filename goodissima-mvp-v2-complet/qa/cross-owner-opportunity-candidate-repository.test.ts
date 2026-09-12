import assert from "node:assert/strict";
import test from "node:test";
import { buildOpportunityRulesV1 } from "../lib/opportunities/opportunity-projection.ts";
import {
  CROSS_OWNER_CANDIDATE_LIMIT_MAX,
  PrismaMatchableOpportunityCandidateRepository,
} from "../lib/matching/cross-owner-opportunity-candidate-repository.ts";

type RawCandidate = { id: string; ownerId: string; status: string; rules: unknown; [key: string]: unknown };

function rules(type: "OFFER" | "NEED", matchingEnabled: boolean | undefined = true) {
  return buildOpportunityRulesV1({}, {
    type,
    criteria: {
      subject: "Garde d’enfants", category: "Services", locations: ["Beauvais"],
      availability: { days: ["TUESDAY"], timeFrom: "18:00", timeTo: "20:00" },
      dateWindow: { from: "2026-10-01", to: "2026-12-31" },
      priceRange: { min: 20, max: 45, currency: "EUR", unit: "hour" }, terms: ["Expérience"],
    },
    ...(matchingEnabled === undefined ? {} : { matchingEnabled }),
  });
}

function rulesWithoutConsent(type: "OFFER" | "NEED") {
  const value = rules(type);
  const opportunity = { ...(value.opportunity as Record<string, unknown>) };
  delete opportunity.matchingEnabled;
  return { ...value, opportunity };
}

function fixture(rows: RawCandidate[]) {
  const calls: unknown[] = [];
  const client = { gLink: { findMany: async (args: any) => { calls.push(args); return rows.slice(0, args.take); } } };
  return { repository: new PrismaMatchableOpportunityCandidateRepository(client as any), calls };
}

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, nested]) => { keys.add(key.toLowerCase()); collectKeys(nested, keys); });
  return keys;
}

test("returns only cross-owner active consented complementary projections", async () => {
  const { repository, calls } = fixture([
    { id: "bob-offer", ownerId: "bob", status: "ACTIVE", rules: rules("OFFER") },
    { id: "alice-offer", ownerId: "alice", status: "ACTIVE", rules: rules("OFFER") },
    { id: "bob-need", ownerId: "bob", status: "ACTIVE", rules: rules("NEED") },
    { id: "source", ownerId: "bob", status: "ACTIVE", rules: rules("OFFER") },
  ]);
  const result = await repository.listEligibleCandidates({ sourceId: "source", sourceOwnerId: "alice", complementaryType: "OFFER", limit: 10 });
  assert.deepEqual(result.map((item) => item.internalTargetRef), ["bob-offer"]);
  assert.deepEqual(result[0]?.projection, {
    schemaVersion: 1, opportunityType: "OFFER", subject: "Garde d’enfants", category: "Services", locations: ["Beauvais"],
    availability: { days: ["TUESDAY"], timeFrom: "18:00", timeTo: "20:00" }, dateWindow: { from: "2026-10-01", to: "2026-12-31" },
    priceRange: { min: 20, max: 45, currency: "EUR", unit: "hour" }, terms: ["Expérience"],
  });
  assert.deepEqual((calls[0] as any).select, { id: true, ownerId: true, status: true, rules: true });
  assert.deepEqual((calls[0] as any).where.ownerId, { not: "alice" });
  assert.deepEqual((calls[0] as any).where.AND, [
    { rules: { path: ["opportunity", "type"], equals: "OFFER" } },
    { rules: { path: ["opportunity", "matchingEnabled"], equals: true } },
  ]);
});

test("supports the inverse OFFER to NEED complementary discovery", async () => {
  const { repository } = fixture([
    { id: "bob-need", ownerId: "bob", status: "ACTIVE", rules: rules("NEED") },
    { id: "bob-offer", ownerId: "bob", status: "ACTIVE", rules: rules("OFFER") },
  ]);
  const result = await repository.listEligibleCandidates({ sourceId: "source-offer", sourceOwnerId: "alice", complementaryType: "NEED", limit: 10 });
  assert.deepEqual(result.map((item) => item.internalTargetRef), ["bob-need"]);
  assert.equal(result[0]?.projection.opportunityType, "NEED");
});

test("defensively excludes absent or false consent, lifecycle states and invalid opportunities", async () => {
  const candidates: RawCandidate[] = [
    { id: "absent", ownerId: "bob", status: "ACTIVE", rules: rulesWithoutConsent("OFFER") },
    { id: "false", ownerId: "bob", status: "ACTIVE", rules: rules("OFFER", false) },
    ...["DRAFT", "DISABLED", "EXPIRED", "ARCHIVED"].map((status) => ({ id: status, ownerId: "bob", status, rules: rules("OFFER") })),
    { id: "simple", ownerId: "bob", status: "ACTIVE", rules: { simpleLink: true, matchingEnabled: true } },
    { id: "legacy", ownerId: "bob", status: "ACTIVE", rules: { creationSource: "opportunity", matchingEnabled: true } },
    { id: "invalid", ownerId: "bob", status: "ACTIVE", rules: { creationSource: "opportunity", opportunity: { schemaVersion: 1, type: "OFFER", matchingEnabled: true, criteria: {} } } },
    { id: "future", ownerId: "bob", status: "ACTIVE", rules: { creationSource: "opportunity", opportunity: { schemaVersion: 2, type: "OFFER", matchingEnabled: true, criteria: { subject: "Future" } } } },
  ];
  const { repository } = fixture(candidates);
  assert.deepEqual(await repository.listEligibleCandidates({ sourceId: "source", sourceOwnerId: "alice", complementaryType: "OFFER", limit: 20 }), []);
});

test("repository result structurally excludes raw private fields and sentinels", async () => {
  const { repository } = fixture([{ id: "target", ownerId: "bob", status: "ACTIVE", rules: rules("OFFER"), title: "PRIVATE_TITLE", description: "PRIVATE_DESCRIPTION", slug: "PRIVATE_SLUG", email: "PRIVATE_EMAIL", phone: "PRIVATE_PHONE", workspace: "PRIVATE_WORKSPACE", documents: ["PRIVATE_DOCUMENT"], messages: ["PRIVATE_MESSAGE"] }]);
  const result = await repository.listEligibleCandidates({ sourceId: "source", sourceOwnerId: "alice", complementaryType: "OFFER", limit: 1 });
  const keys = collectKeys(result);
  for (const key of ["title", "description", "slug", "url", "email", "phone", "documents", "messages", "relationcase", "fields", "workspace"]) assert.equal(keys.has(key), false, key);
  const serialized = JSON.stringify(result);
  for (const sentinel of ["PRIVATE_TITLE", "PRIVATE_DESCRIPTION", "PRIVATE_SLUG", "PRIVATE_EMAIL", "PRIVATE_PHONE", "PRIVATE_WORKSPACE", "PRIVATE_DOCUMENT", "PRIVATE_MESSAGE"]) assert.equal(serialized.includes(sentinel), false, sentinel);
});

test("limit is strict, bounded and applied without side effects", async () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ id: `candidate-${index}`, ownerId: `owner-${index}`, status: "ACTIVE", rules: rules("OFFER") }));
  const { repository, calls } = fixture(rows);
  assert.equal((await repository.listEligibleCandidates({ sourceId: "source", sourceOwnerId: "alice", complementaryType: "OFFER", limit: 3 })).length, 3);
  assert.equal(calls.length, 1);
  for (const limit of [0, -1, CROSS_OWNER_CANDIDATE_LIMIT_MAX + 1, 1.5]) {
    await assert.rejects(repository.listEligibleCandidates({ sourceId: "source", sourceOwnerId: "alice", complementaryType: "OFFER", limit }), RangeError);
  }
  assert.equal(calls.length, 1);
});
