import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const paths = [
  "app/api/internal/relation-cases/[relationCaseId]/governed-memory/state/route.ts",
  "app/api/internal/relation-cases/[relationCaseId]/governed-memory/compare/route.ts",
  "app/api/internal/relation-cases/[relationCaseId]/governed-memory/decisions/[decisionId]/explanation/route.ts",
  "app/api/internal/relation-cases/[relationCaseId]/governed-memory/access/route.ts",
  "app/api/internal/relation-cases/[relationCaseId]/governed-memory/timeline/route.ts",
  "app/api/internal/relation-cases/[relationCaseId]/governed-memory/objects/[objectType]/[objectId]/trace/route.ts",
];
const routeSources = paths.map((path) => readFileSync(path, "utf8"));

test("six internal routes expose GET only and delegate to the HTTP layer", () => {
  assert.equal(routeSources.length, 6);
  for (const route of routeSources) { assert.match(route, /export async function GET/); assert.match(route, /dynamic = "force-dynamic"/); assert.match(route, /revalidate = 0/); assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/); }
});

test("routes cannot bypass MG-3 or import persistence and Prisma", () => {
  const all = routeSources.join("\n");
  assert.doesNotMatch(all, /@\/lib\/prisma|persistence\/repository|persistence\/service|permission-resolver|@prisma\/client/);
  assert.doesNotMatch(all, /\.(create|update|updateMany|delete|deleteMany|upsert)\(/);
});

test("HTTP exposure adds no AI, UI, wildcard CORS or generated narrative", () => {
  const http = [readFileSync("lib/governed-memory/http/handlers.ts", "utf8"), ...routeSources].join("\n");
  assert.doesNotMatch(http, /OpenAI|Mistral|embedding|vector|prompt|React|useState|reasonGenerated|Access-Control-Allow-Origin/i);
});
