import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const route = read("app/api/links/[linkId]/matching/route.ts");
const repository = read("lib/matching/matching-repository.ts");
const execution = read("lib/matching/matching-execution-service.ts");
const lifecycle = read("lib/matching/matching-lifecycle-service.ts");
const summary = read("lib/matching/glink-matching-summary-repository.ts");

test("every GLink matching verb authenticates and bounds external identifiers", () => {
  assert.equal([...route.matchAll(/const owner = await getCurrentPrismaUser\(\)/g)].length, 3);
  assert.match(route, /MATCHING_IDENTIFIER_MAX_LENGTH = 191/);
  assert.match(route, /parseMatchingIdentifier\(params\.linkId\)/);
  assert.match(route, /parseMatchingIdentifier\(body\?\.runId\)/);
  assert.match(route, /parseMatchingIdentifier\(body\?\.resultId\)/);
  assert.match(route, /MATCHING_REQUEST_INVALID/);
});

test("POST rejects malformed JSON while preserving an optional bounded idempotency key", () => {
  const reader = route.slice(route.indexOf("async function readIdempotencyKey"), route.indexOf("function publicRun"));
  assert.match(reader, /await request\.text\(\)/);
  assert.match(reader, /JSON\.parse\(rawBody\)/);
  assert.match(reader, /MATCHING_IDEMPOTENCY_KEY_INVALID/);
  assert.match(execution, /GLINK_MATCHING_IDEMPOTENCY_KEY_MAX_LENGTH = 160/);
});

test("owner scope and expected state protect every persistent matching mutation", () => {
  assert.match(repository, /where: \{ id: runId, ownerId \}/);
  assert.match(repository, /where: \{ id: resultId, runId, run: \{ ownerId \} \}/);
  assert.match(repository, /ownerId: input\.ownerId, status: input\.expectedRunStatus, isPaused: false/);
  assert.match(repository, /ownerId: input\.ownerId, status: input\.expectedStatus, isPaused: input\.expectedPaused/);
  assert.match(lifecycle, /run\.gLinkId !== input\.gLinkId/);
  assert.doesNotMatch(repository, /matching(?:Run|Result)\.(?:update|delete)\(/);
});

test("grouped summaries stay minimal, deterministic and free of N+1 reads", () => {
  assert.match(summary, /where: \{ ownerId, gLinkId: \{ in: gLinkIds \} \}/);
  assert.match(summary, /distinct: \["gLinkId"\]/);
  assert.match(summary, /orderBy: \[\{ gLinkId: "asc" \}, \{ createdAt: "desc" \}, \{ id: "desc" \}\]/);
  assert.match(summary, /results: \{ select: \{ status: true \} \}/);
  assert.doesNotMatch(summary, /explanation|criteriaSnapshot|for \([^)]*\)[^{]*await/);
});

test("public responses and logs expose no internal ownership, stack, SQL or exception message", () => {
  const serializers = route.slice(route.indexOf("function publicRun"));
  assert.doesNotMatch(serializers, /ownerId|criteriaSnapshot|idempotencyKey/);
  assert.doesNotMatch(route, /error\.stack|PrismaClient|P20\d\d|error instanceof Error \? error\.message/);
  assert.doesNotMatch(execution, /error instanceof Error \? error\.message/);
});

test("public HTTP mapping uses only the stabilized 400, 404, 409 and 500 classes", () => {
  assert.doesNotMatch(route, /status:\s*422|return 422/);
  assert.match(route, /MATCHING_IDEMPOTENCY_KEY_INVALID[^]*return 400/);
  assert.match(route, /MATCHING_SOURCE_NOT_FOUND[^]*return 404/);
  assert.match(route, /return 409/);
  assert.match(route, /MATCHING_(?:EXECUTION|READ|LIFECYCLE|DECISION)_FAILED/);
});

test("persistent GLink matching has no legacy decisions or automatic business consequences", () => {
  const scope = [route, repository, execution, lifecycle, summary, read("components/GLinkMatchingPanel.tsx")].join("\n");
  assert.doesNotMatch(scope, /glink_matching_interested|glink_matching_ignored|INTERESTING|IGNORED|legacyMatch|initialMatches|initialAnalyzed/);
  assert.doesNotMatch(scope, /sendEmail|sendMail|notification|invitation|candidateAccessToken|relationCase\.(?:create|update)|nextStatus:\s*"LINKED"/i);
  assert.match(route, /glink_matching_analysis/);
});
