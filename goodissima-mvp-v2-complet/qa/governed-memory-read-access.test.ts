import assert from "node:assert/strict";
import test from "node:test";
import { filterMemoryReadByCurrentAccess } from "../lib/governed-memory/read/access-filter.ts";
import { accessView } from "../lib/governed-memory/read/state-builder.ts";

const source: any = { id: "source-secret", kind: "DOCUMENT", status: "RESTRICTED", title: "Titre confidentiel", authoredAt: null, receivedAt: null, recordedAt: new Date("2026-01-01Z"), visibilityPolicyRef: "RESTRICTED:legal", unavailableReason: null };

test("steward-style broad permissions do not reveal a targeted restricted source", () => {
  const result = filterMemoryReadByCurrentAccess([source], { permissions: new Set(["VIEW_MEMORY", "VIEW_SOURCES"]), sourceResourceIds: new Set() } as never);
  assert.deepEqual(result.visible, []);
  assert.equal(result.redactions[0].level, "FULLY_HIDDEN");
  assert.equal(result.redactions[0].disclosedId, null);
  assert.doesNotMatch(JSON.stringify(result), /Titre confidentiel/);
});

test("targeted current access reveals the source and deleted content remains unavailable", () => {
  const result = filterMemoryReadByCurrentAccess([{ ...source, status: "DELETED" }], { permissions: new Set(["VIEW_MEMORY", "VIEW_SOURCES"]), sourceResourceIds: new Set(["source-secret"]) } as never);
  assert.equal(result.visible[0].available, false);
  assert.equal(result.visible[0].title, "Unavailable source");
});

test("historical grants distinguish active, revoked, expired and residual", () => {
  const base = { id: "g", subjectType: "USER", subjectUserId: "u", subjectRepresentationId: null, permission: "VIEW_MEMORY", resourceType: null, resourceId: null, effectiveFrom: new Date("2026-01-01Z"), effectiveUntil: null, revokedAt: new Date("2026-03-01Z"), residualPermission: "VIEW_MEMORY", residualEffectiveUntil: new Date("2026-04-01Z") } as never;
  assert.equal(accessView(base, new Date("2026-02-01Z")).stateAtReference, "ACTIVE");
  assert.equal(accessView(base, new Date("2026-03-15Z")).stateAtReference, "RESIDUAL");
  assert.equal(accessView(base, new Date("2026-05-01Z")).stateAtReference, "REVOKED");
});
