import assert from "node:assert/strict";
import test from "node:test";
import { isTemporallyValid, selectStateAt, wasAccessibleAt, wasEffectiveAt, wasKnownAt } from "../lib/governed-memory/temporal.ts";
import type { GovernedMemoryAccessGrant, GovernedMemoryTemporal } from "../lib/governed-memory/types.ts";

const temporal = (overrides: Partial<GovernedMemoryTemporal> = {}): GovernedMemoryTemporal => ({ recordedAt: "2026-03-01T00:00:00.000Z", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveUntil: null, ...overrides });

test("a retroactive fact may be effective before it was known", () => {
  const item = temporal();
  assert.equal(wasEffectiveAt(item, "2026-02-01T00:00:00.000Z"), true);
  assert.equal(wasKnownAt(item.recordedAt, "2026-02-01T00:00:00.000Z"), false);
  assert.deepEqual(selectStateAt([item], "2026-02-01T00:00:00.000Z"), []);
});

test("known information may no longer be effective", () => {
  const item = temporal({ effectiveUntil: "2026-04-01T00:00:00.000Z" });
  assert.equal(wasKnownAt(item.recordedAt, "2026-05-01T00:00:00.000Z"), true);
  assert.equal(wasEffectiveAt(item, "2026-05-01T00:00:00.000Z"), false);
});

test("superseded decisions disappear only after supersession was recorded", () => {
  const item = temporal({ supersededAt: "2026-04-15T00:00:00.000Z" });
  assert.equal(selectStateAt([item], "2026-04-01T00:00:00.000Z").length, 1);
  assert.equal(selectStateAt([item], "2026-05-01T00:00:00.000Z").length, 0);
});

test("invalid intervals and future recording are rejected with injected clock", () => {
  assert.equal(isTemporallyValid(temporal({ effectiveUntil: "2025-12-31T00:00:00.000Z" }), "2026-06-01T00:00:00.000Z"), false);
  assert.equal(isTemporallyValid(temporal({ recordedAt: "2027-01-01T00:00:00.000Z" }), "2026-06-01T00:00:00.000Z"), false);
});

test("access closes at revocation even when the original end is open", () => {
  const grant = { effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveUntil: null, revokedAt: "2026-03-01T00:00:00.000Z" } as GovernedMemoryAccessGrant;
  assert.equal(wasAccessibleAt(grant, "2026-02-01T00:00:00.000Z"), true);
  assert.equal(wasAccessibleAt(grant, "2026-04-01T00:00:00.000Z"), false);
});

test("source authored date does not replace received or recorded knowledge dates", () => {
  const authoredAt = "2025-01-01T00:00:00.000Z";
  const receivedAt = "2026-02-01T00:00:00.000Z";
  const recordedAt = "2026-03-01T00:00:00.000Z";
  assert.ok(Date.parse(authoredAt) < Date.parse(receivedAt));
  assert.equal(wasKnownAt(recordedAt, receivedAt), false);
});
