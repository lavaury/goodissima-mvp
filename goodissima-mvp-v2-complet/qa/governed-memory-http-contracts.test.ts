import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAccessQuery, parseCompareQuery, parseExplanationQuery, parseObjectType, parseStateQuery, parseTimelineQuery } from "../lib/governed-memory/http/query-parsers.ts";

test("strict parsers normalize valid HTTP inputs", () => {
  assert.deepEqual(parseStateQuery(new URLSearchParams("referenceDate=2026-08-01T00%3A00%3A00Z&knowledgeMode=KNOWN_AT_DATE&include=FACTS%2CDECISIONS&limit=50")), { referenceDate: "2026-08-01T00:00:00.000Z", knowledgeMode: "KNOWN_AT_DATE", include: ["FACTS", "DECISIONS"], limit: 50, cursor: undefined });
  assert.equal(parseObjectType("SOURCE"), "SOURCE");
  assert.equal(parseExplanationQuery(new URLSearchParams()).referenceDate, undefined);
});

test("unknown, duplicated, malformed and excessive parameters are rejected", () => {
  for (const query of ["referenceDate=no&knowledgeMode=KNOWN_AT_DATE", "referenceDate=2026-08-01T00%3A00%3A00Z&knowledgeMode=OTHER", "referenceDate=2026-08-01T00%3A00%3A00Z&knowledgeMode=KNOWN_AT_DATE&limit=201", "referenceDate=2026-08-01T00%3A00%3A00Z&knowledgeMode=KNOWN_AT_DATE&requesterUserId=attacker", "referenceDate=2026-08-01T00%3A00%3A00Z&referenceDate=2026-08-02T00%3A00%3A00Z&knowledgeMode=KNOWN_AT_DATE"]) assert.throws(() => parseStateQuery(new URLSearchParams(query)));
  assert.throws(() => parseObjectType("MESSAGE"));
  assert.throws(() => parseCompareQuery(new URLSearchParams("from=2026-08-02T00%3A00%3A00Z&to=2026-08-01T00%3A00%3A00Z&knowledgeMode=KNOWN_AT_EACH_DATE")));
  assert.throws(() => parseTimelineQuery(new URLSearchParams("from=2026-08-01T00%3A00%3A00Z&to=2026-08-02T00%3A00%3A00Z&include=SOURCES")));
});

test("access reconstruction accepts the implicit requester or one bounded subject", () => {
  const referenceDate = "referenceDate=2026-08-01T00%3A00%3A00Z";
  assert.equal(parseAccessQuery(new URLSearchParams(`${referenceDate}&subjectUserId=user_1`)).subjectUserId, "user_1");
  assert.equal(parseAccessQuery(new URLSearchParams(referenceDate)).subjectUserId, undefined);
  assert.throws(() => parseAccessQuery(new URLSearchParams(`${referenceDate}&subjectUserId=u&subjectRepresentationId=r`)));
});

test("HTTP contracts contain stable success and failure envelopes", () => {
  const code = readFileSync("lib/governed-memory/http/contracts.ts", "utf8");
  assert.match(code, /ok: true/); assert.match(code, /ok: false/); assert.match(code, /requestId: string/); assert.match(code, /generatedAt: string/);
  assert.doesNotMatch(code, /Prisma|stack|transactionId/);
});
