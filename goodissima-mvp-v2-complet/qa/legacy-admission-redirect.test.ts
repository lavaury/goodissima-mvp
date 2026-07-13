import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public form redirects only with the RelationCase candidate access token", () => {
  const form = source("app/l/[slug]/candidate-form.tsx");
  assert.match(form, /fetch\("\/api\/cases"/);
  assert.match(form, /typeof relationCase\.candidateAccessToken === "string"/);
  assert.match(form, /router\.push\(`\/secure\/\$\{encodeURIComponent\(candidateAccessToken\)\}`\)/);
  assert.doesNotMatch(form, /router\.push\(`\/secure\/\$\{encodeURIComponent\(trustAdmissionToken\)/);
});

test("API returns the candidate token for both created and existing cases", () => {
  const route = source("app/api/cases/route.ts");
  assert.match(route, /withCandidateCookie\(existingRelationCase\.candidateAccessToken, gLink\.id, existingRelationCase\.id\)/);
  assert.match(route, /withCandidateCookie\(relationCase\.candidateAccessToken, gLink\.id, relationCase\.id\)/);
  assert.match(route, /NextResponse\.json\(\{ candidateAccessToken: token \}\)/);
  assert.match(route, /secureTrace\("candidate_case_created"/);
  assert.match(route, /secureTrace\("candidate_redirect"/);
  assert.match(route, /candidateIdentityId: resolvedCandidateIdentityId/);
  assert.match(route, /candidateAccessRevokedAt: null/);
  assert.match(route, /take: 2/);
  assert.match(route, /existingRelationCases\.length === 1/);
  assert.doesNotMatch(route, /candidateEmail: \{ equals: candidateEmail/);
});

test("legacy confirmation never trusts an admission query token directly", () => {
  const confirmation = source("app/l/[slug]/confirmation/page.tsx");
  assert.match(confirmation, /activeCandidateAccessWhere\(token\)/);
  assert.match(confirmation, /goodissima_candidate_/);
  assert.match(confirmation, /encodeURIComponent\(candidateAccessToken\)/);
  assert.doesNotMatch(confirmation, /encodeURIComponent\(searchParams\.token\)/);
});

test("owner new-case email receives the created RelationCase id", () => {
  const route = source("app/api/cases/route.ts");
  assert.match(route, /sendNewRelationCaseEmail\(\{[\s\S]*caseId: relationCase\.id,/);
});
