import assert from "node:assert/strict";
import test from "node:test";
import { memoryQuery, toUtcIso } from "../lib/governed-memory/client/query.ts";

test("dates are serialized explicitly as UTC without losing instants", () => {
  assert.equal(toUtcIso("2026-03-29T03:30:00+02:00"), "2026-03-29T01:30:00.000Z");
  assert.equal(toUtcIso("2026-10-25T02:30:00+01:00"), "2026-10-25T01:30:00.000Z");
  assert.equal(toUtcIso("2026-08-03T00:00:00Z"), "2026-08-03T00:00:00.000Z");
});

test("query serialization encodes dates and omits absent cursors", () => {
  const query = memoryQuery({ from: "2026-08-01T00:00:00.000Z", to: "2026-08-02T00:00:00.000Z", cursor: undefined });
  assert.match(query, /from=2026-08-01T00%3A00%3A00.000Z/); assert.doesNotMatch(query, /cursor/);
});

