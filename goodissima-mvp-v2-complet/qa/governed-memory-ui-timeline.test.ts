import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const page = readFileSync("components/governed-memory/GovernedMemoryPage.tsx", "utf8");
const api = readFileSync("lib/governed-memory/client/api.ts", "utf8");
const presenters = readFileSync("components/governed-memory/MemoryPresenters.tsx", "utf8");

test("timeline uses only the server nextCursor and never an offset", () => {
  assert.match(page, /data\.pagination\?\.nextCursor/); assert.match(page, /loadTimeline\(true\)/); assert.match(api, /cursor: input\.cursor/);
  assert.doesNotMatch(`${page}\n${api}`, /offset|pageNumber|\.sort\(/);
});

test("period changes abort and invalidate stale responses without fetch loops", () => {
  assert.match(page, /AbortController/); assert.match(page, /requestVersion\.current/); assert.match(page, /version !== requestVersion\.current/); assert.match(page, /controller\.current\?\.abort\(\)/);
  assert.doesNotMatch(page, /useEffect\([^)]*fetch|setInterval|while\s*\(/);
});

test("timeline explains inclusive from, exclusive to and server order", () => {
  assert.match(page, /début inclusif, fin exclusive/); assert.match(page, /date de survenue, puis identifiant stable/); assert.match(presenters, /Survenu/); assert.match(presenters, /Enregistré/);
});
