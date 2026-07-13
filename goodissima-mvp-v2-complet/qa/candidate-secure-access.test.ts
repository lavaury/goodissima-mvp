import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("secure page and messages share the minimal candidate token resolver", () => {
  const access = source("lib/candidate-access.ts");
  const page = source("app/secure/[token]/page.tsx");
  const messages = source("app/api/messages/route.ts");

  assert.match(access, /resolveCandidateSecureAccess/);
  assert.match(access, /diagnoseCandidateSecureAccess/);
  assert.match(access, /candidateAccessRevokedAt: null/);
  assert.match(access, /candidateAccessExpiresAt: \{ gt: now \}/);
  assert.match(access, /select: \{ id: true, candidateAccessRevokedAt: true, candidateAccessExpiresAt: true \}/);
  assert.match(page, /diagnoseCandidateSecureAccess\(params\.token\)/);
  assert.match(messages, /resolveCandidateSecureAccess\(params\.candidateAccessToken\)/);
  assert.doesNotMatch(messages, /secureLink: `\/secure\/\$\{/);
  assert.match(page, /failureStep: "conversation-load"/);
  assert.match(page, /failureStep: "missing-relation"/);
  assert.match(page, /token\.slice\(0, 6\)/);
  assert.match(page, /Certains éléments de contexte de cette ancienne annonce ne sont pas disponibles\./);
});
