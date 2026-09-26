import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createPublicRelationRequestFollowUpToken, verifyPublicRelationRequestFollowUpToken } from "../lib/public-relation-request-followup.ts";

const previousSecret = process.env.RATE_LIMIT_HMAC_SECRET;
process.env.RATE_LIMIT_HMAC_SECRET = "request-follow-up-test-secret-at-least-32-characters";
test.after(() => { if (previousSecret === undefined) delete process.env.RATE_LIMIT_HMAC_SECRET; else process.env.RATE_LIMIT_HMAC_SECRET = previousSecret; });
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("signed follow-up token binds request, link and expiry without PII", () => {
  const expiresAt = new Date("2026-10-01T12:00:00Z");
  const token = createPublicRelationRequestFollowUpToken({ requestId: "request-1", gLinkId: "link-1", expiresAt });
  assert.deepEqual(verifyPublicRelationRequestFollowUpToken(token, new Date("2026-09-26T12:00:00Z")), { r: "request-1", g: "link-1", e: Math.floor(expiresAt.getTime() / 1000) });
  assert.doesNotMatch(token, /Ada|email|example|secret/i);
  assert.equal(verifyPublicRelationRequestFollowUpToken(`${token.slice(0, -1)}x`, new Date("2026-09-26T12:00:00Z")), null);
  assert.equal(verifyPublicRelationRequestFollowUpToken(token, expiresAt), null);
});

test("public page verifies both bound ids before reading and exposes only its resulting case", () => {
  const page = read("app/demande/[token]/page.tsx");
  assert.match(page, /verifyPublicRelationRequestFollowUpToken\(params\.token\)/);
  assert.match(page, /id: claims\.r, gLinkId: claims\.g/);
  assert.match(page, /claims\.e > Math\.floor\(request\.expiresAt\.getTime\(\) \/ 1000\)/);
  assert.match(page, /relationCase\?\.id === request\.relationCaseId/);
  assert.match(page, /Votre demande est en attente de décision/);
  assert.match(page, /Votre demande a été acceptée/);
  assert.match(page, /Votre demande n’a pas été acceptée/);
  assert.doesNotMatch(page, /candidateEmail|candidateName/);
});

test("pending API responses and idempotent replay return the same secure follow-up", () => {
  const route = read("app/api/cases/route.ts"); const idempotency = read("lib/public-case-idempotency.ts"); const form = read("app/l/[slug]/candidate-form.tsx");
  assert.match(idempotency, /kind: "FOLLOW_UP"/);
  assert.match(route, /followUpUrl: publicRelationRequestFollowUpUrl/);
  assert.match(form, /router\.push\(relationCase\.followUpUrl\)/);
  assert.match(route, /RELATION_REQUEST_CREATED", metadata: \{ requestId: pendingRequest\.id, gLinkId: gLink\.id \} \}/);
});

test("pending status refreshes lightly and never auto-redirects", () => {
  const refresh = read("components/PublicRelationRequestStatusRefresh.tsx");
  assert.match(refresh, /20_000/); assert.match(refresh, /router\.refresh\(\)/); assert.doesNotMatch(refresh, /router\.(?:push|replace)/);
});

test("context link scrolls and focuses the stable target", () => {
  const context = read("components/PublicResponseContext.tsx"); const page = read("app/l/[slug]/page.tsx");
  assert.match(context, /↑ Voir l’annonce complète/); assert.match(context, /scrollIntoView/); assert.match(context, /focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /id="public-link-context" tabIndex=\{-1\}/); assert.match(page, /scroll-mt-6/);
});
