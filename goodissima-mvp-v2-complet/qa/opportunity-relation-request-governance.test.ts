import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("modern opportunity owner page reuses governed requests and historical cases", () => {
  const page = read("app/(connected)/opportunities/[id]/page.tsx");
  assert.match(page, /ownerId: owner\.id/);
  assert.match(page, /publicCaseCreationRequests/);
  assert.match(page, /status: \{ in: \["PENDING", "ACCEPTED", "DECLINED"\] \}/);
  assert.match(page, /requestPayload: \{ not: Prisma\.DbNull \}/);
  assert.match(page, /projectRelationRequestView/);
  assert.match(page, /<RelationRequestsPanel requests=\{relationRequests\} gLinkId=\{item\.id\}/);
  assert.match(page, /requestCaseIds/);
  assert.match(page, /legacyCases = item\.cases\.filter/);
  assert.match(page, /Historique|RelationRequestsPanel/);
});

test("matching remains an independent existing block", () => {
  const page = read("app/(connected)/opportunities/[id]/page.tsx");
  assert.match(page, /<OpportunityMatchingControls/);
  assert.ok(page.indexOf("<RelationRequestsPanel") < page.indexOf("<OpportunityMatchingControls"));
});

test("owner destinations use one business classification rule", () => {
  const attention = read("lib/pending-relation-request-attention.ts");
  const relations = read("app/(connected)/relations/page.tsx");
  for (const source of [attention, relations]) assert.match(source, /relationRequestOwnerHref/);
  assert.doesNotMatch(attention, /href: `\/links\//);
  assert.doesNotMatch(relations, /href=\{`\/links\/\$\{request\.gLinkId\}/);
});

test("opportunity requester follows the same secure pending URL", () => {
  const exchange = read("components/PublicOpportunitySecureExchange.tsx");
  assert.match(exchange, /result\.status === "PENDING"/);
  assert.match(exchange, /result\.followUpUrl\.startsWith\("\/demande\/"\)/);
  assert.match(exchange, /router\.push\(result\.followUpUrl\)/);
});

test("existing decision routes remain owner and gLink bound", () => {
  const decisions = read("lib/public-relation-request.ts");
  assert.match(decisions, /request\.gLink\.ownerId !== input\.actorUserId/);
  assert.match(decisions, /request\.gLinkId !== input\.gLinkId/);
  assert.match(decisions, /RELATION_REQUEST_NOT_PENDING/);
});
