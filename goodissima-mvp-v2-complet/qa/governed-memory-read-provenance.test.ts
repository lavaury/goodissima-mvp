import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterMemoryReadByCurrentAccess } from "../lib/governed-memory/read/access-filter.ts";

const source = (overrides: Record<string, unknown> = {}) => ({ id: "source-a", governedJourneyId: null, governedJourneyEventId: null, kind: "DOCUMENT", status: "ACTIVE", title: "Source A", authoredAt: null, receivedAt: null, recordedAt: new Date("2026-08-01T10:00:00Z"), visibilityPolicyRef: null, unavailableReason: null, ...overrides });
const broadAccess = { permissions: new Set(["VIEW_MEMORY", "VIEW_SOURCES"]), sourceResourceIds: new Set<string>() } as never;

test("a historical source has nullable provenance", () => {
  const result = filterMemoryReadByCurrentAccess([source()] as never[], broadAccess);
  assert.equal(result.visible[0].provenance, null);
});

test("journey-only and event provenance are projected without technical identities", () => {
  const row = source({ governedJourneyId: "journey-a", governedJourneyEventId: "event-a" });
  const context = new Map([["source-a", { governedJourney: { id: "journey-a", title: "Parcours locatif", status: "CLOSED" }, governedJourneyEvent: { id: "event-a", governedJourneyId: "journey-a", type: "SUSPENDED", fromStatus: "ACTIVE", toStatus: "SUSPENDED", sequence: 3, occurredAt: new Date("2026-08-01T09:00:00Z") } }]]) as never;
  const projected = filterMemoryReadByCurrentAccess([row] as never[], broadAccess, context).visible[0].provenance;
  assert.deepEqual(projected, { governedJourney: { title: "Parcours locatif", currentStatus: "CLOSED" }, governedJourneyEvent: { type: "SUSPENDED", fromStatus: "ACTIVE", toStatus: "SUSPENDED", sequence: 3, occurredAt: "2026-08-01T09:00:00.000Z" } });
  assert.notEqual(projected?.governedJourney.currentStatus, projected?.governedJourneyEvent?.toStatus);
  assert.doesNotMatch(JSON.stringify(projected), /journey-a|event-a|reason|actorUserId|authorityUserId/);
  const journeyOnly = new Map([["source-a", { governedJourney: { id: "journey-a", title: "Parcours locatif", status: "ACTIVE" }, governedJourneyEvent: null }]]) as never;
  assert.equal(filterMemoryReadByCurrentAccess([source({ governedJourneyId: "journey-a" })] as never[], broadAccess, journeyOnly).visible[0].provenance?.governedJourneyEvent, null);
});

test("hidden and restricted sources expose no provenance context", () => {
  const privateSource = source({ governedJourneyId: "journey-secret", status: "RESTRICTED", visibilityPolicyRef: "EXISTENCE_DISCLOSED:legal", title: "Secret" });
  const denied = filterMemoryReadByCurrentAccess([privateSource] as never[], broadAccess);
  assert.deepEqual(denied.visibleRows, []);
  assert.doesNotMatch(JSON.stringify(denied), /journey-secret|Secret/);
  const noSources = filterMemoryReadByCurrentAccess([source({ governedJourneyId: "journey-secret" })] as never[], { permissions: new Set(["VIEW_MEMORY"]), sourceResourceIds: new Set() } as never);
  assert.deepEqual(noSources.visibleRows, []);
});

test("the repository batches only visible ids and keeps every query case-scoped", () => {
  const repository = readFileSync("lib/governed-memory/read/repository.ts", "utf8");
  const service = readFileSync("lib/governed-memory/read/service.ts", "utf8");
  const method = repository.slice(repository.indexOf("async readSourceProvenance"), repository.indexOf("async getDecisionTrace"));
  assert.match(method, /new Set/);
  assert.match(method, /if \(!journeyIds\.length\) return/);
  assert.equal((method.match(/governedJourney\.findMany/g) ?? []).length, 1);
  assert.equal((method.match(/governedJourneyEvent\.findMany/g) ?? []).length, 1);
  assert.equal((method.match(/where: \{ relationCaseId/g) ?? []).length, 2);
  assert.doesNotMatch(method, /reason|actorUserId|authorityUserId|template|invitation|session/i);
  assert.ok(service.indexOf("filterMemoryReadByCurrentAccess(sources, access).visibleRows") < service.indexOf("reader.readSourceProvenance(relationCaseId, visibleRows)"));
});

test("missing same-case context degrades to null without hiding the source", () => {
  const result = filterMemoryReadByCurrentAccess([source({ governedJourneyId: "missing" })] as never[], broadAccess, new Map());
  assert.equal(result.visible.length, 1);
  assert.equal(result.visible[0].provenance, null);
});

test("GJ-3 changes no schema, migration, write service or route surface", () => {
  const repository = readFileSync("lib/governed-memory/read/repository.ts", "utf8");
  const service = readFileSync("lib/governed-memory/read/service.ts", "utf8");
  assert.doesNotMatch(`${repository}\n${service}`, /\.(create|update|delete|upsert)\(/);
  assert.doesNotMatch(`${repository}\n${service}`, /notification|invitation|communicationSession|OpenAI|Mistral|embedding/i);
});
