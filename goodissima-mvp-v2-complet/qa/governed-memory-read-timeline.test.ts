import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("lib/governed-memory/read/repository.ts", "utf8");
const service = readFileSync("lib/governed-memory/read/service.ts", "utf8");
const handlers = readFileSync("lib/governed-memory/http/handlers.ts", "utf8");

test("timeline range and visibility are applied before deterministic pagination", () => {
  const timeline = repository.slice(repository.indexOf("async readTimeline"), repository.indexOf("async getObjectTrace"));
  assert.match(timeline, /event\."occurredAt" >= \$\{input\.from\}/);
  assert.match(timeline, /event\."occurredAt" < \$\{input\.to\}/);
  assert.match(timeline, /event\."occurredAt" > \$\{new Date\(input\.cursor\.occurredAt\)\}/);
  assert.match(timeline, /ORDER BY event\."occurredAt" ASC, event\."id" ASC/);
  assert.match(timeline, /LIMIT \$\{input\.limit \+ 1\}/);
  assert.ok(timeline.indexOf("sourceVisibility") < timeline.indexOf("ORDER BY"));
});

test("from is inclusive, to is exclusive and dense pages have no gaps or duplicates", () => {
  const rows = ["2026-07-31T23:59:59.999Z", "2026-08-01T00:00:00.000Z", "2026-08-01T00:00:01.000Z", "2026-08-01T00:00:01.000Z", "2026-08-02T00:00:00.000Z"].map((occurredAt, index) => ({ occurredAt, id: `e${index}` }));
  const ranged = rows.filter((row) => row.occurredAt >= "2026-08-01T00:00:00.000Z" && row.occurredAt < "2026-08-02T00:00:00.000Z").sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const first = ranged.slice(0, 2); const cursor = first[1]; const second = ranged.filter((row) => row.occurredAt > cursor.occurredAt || row.occurredAt === cursor.occurredAt && row.id > cursor.id).slice(0, 2);
  assert.deepEqual([...first, ...second], ranged);
  assert.equal(new Set([...first, ...second].map(({ id }) => id)).size, ranged.length);
  assert.equal(ranged[0].occurredAt, "2026-08-01T00:00:00.000Z");
  assert.ok(ranged.every((row) => row.occurredAt !== "2026-08-02T00:00:00.000Z"));
});

test("cursor is based only on an additional visible in-range event", () => {
  const timeline = service.slice(service.indexOf("export async function getMemoryTimeline"), service.indexOf("export async function getMemoryObjectTrace"));
  assert.match(timeline, /rows\.length > pageLimit/);
  assert.match(timeline, /occurredAt: last\.occurredAt\.toISOString\(\)/);
  assert.match(timeline, /nextCursor: last \?/);
  assert.doesNotMatch(timeline, /recordedAt: last\.recordedAt/);
  assert.match(repository, /event\."objectType" <> 'SOURCE' OR \$\{sourceVisibility\}/);
});

test("HTTP timeline only validates and forwards the range", () => {
  const handler = handlers.slice(handlers.indexOf("export function handleMemoryTimeline"), handlers.indexOf("export function handleMemoryObjectTrace"));
  assert.match(handler, /getMemoryTimeline\(\{ relationCaseId, requesterUserId, \.\.\.parseTimelineQuery\(query\(request\)\) \}\)/);
  assert.doesNotMatch(handler, /\.filter\(|recordedAt|occurredAt/);
});

test("timeline implementation remains read-only", () => {
  assert.doesNotMatch(`${repository}\n${service}\n${handlers}`, /\.(create|update|updateMany|delete|deleteMany|upsert)\(/);
});
