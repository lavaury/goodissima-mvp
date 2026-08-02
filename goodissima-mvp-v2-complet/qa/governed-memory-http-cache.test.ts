import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cache = readFileSync("lib/governed-memory/http/cache-policy.ts", "utf8");
const response = readFileSync("lib/governed-memory/http/response-mapper.ts", "utf8");

test("all success and failure responses are private and non-cacheable", () => {
  assert.match(cache, /private, no-store, max-age=0, must-revalidate/); assert.match(cache, /Pragma: "no-cache"/); assert.match(response, /noStore\(\)/);
});

test("every route is forced dynamic without permissive CORS", () => {
  const route = readFileSync("app/api/internal/relation-cases/[relationCaseId]/governed-memory/state/route.ts", "utf8");
  assert.match(route, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(`${cache}\n${response}`, /Access-Control-Allow-Origin/);
});
