import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pickCanonicalRelationCaseId } from "../lib/canonical-relation-case-picker.ts";

const now = new Date("2026-07-13T12:00:00.000Z");
function candidate(id: string, messageAt?: string, revoked = false) {
  return {
    id,
    createdAt: new Date(id === "legacy" ? "2026-07-01T00:00:00Z" : "2026-07-10T00:00:00Z"),
    candidateAccessRevokedAt: revoked ? new Date("2026-07-11T00:00:00Z") : null,
    candidateAccessExpiresAt: null,
    messages: messageAt ? [{ createdAt: new Date(messageAt) }] : [],
  };
}

test("ambiguous active Trust Admission duplicates are not canonicalized", () => {
  assert.equal(pickCanonicalRelationCaseId([
    candidate("legacy", "2026-07-02T00:00:00Z"),
    candidate("canonical", "2026-07-12T00:00:00Z"),
  ], now), null);
});

test("a standalone Garage case remains canonical", () => {
  assert.equal(pickCanonicalRelationCaseId([candidate("garage", "2026-07-12T00:00:00Z")], now), "garage");
});

test("a unique active access is canonical when historical access is revoked", () => {
  assert.equal(pickCanonicalRelationCaseId([candidate("legacy", undefined, true), candidate("canonical")], now), "canonical");
});

test("owner routing and notification use the message RelationCase", () => {
  const page = readFileSync(new URL("../app/cases/[caseId]/page.tsx", import.meta.url), "utf8");
  const messages = readFileSync(new URL("../app/api/messages/route.ts", import.meta.url), "utf8");
  const email = readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");
  assert.match(page, /resolveCanonicalOwnerRelationCaseId\(params\.caseId, owner\.id\)/);
  assert.match(page, /redirect\(`\/cases\/\$\{encodeURIComponent\(canonicalCaseId\)\}/);
  assert.match(messages, /sendNewMessageEmail\(\{[\s\S]*caseId: relationCase\.id,/);
  assert.match(email, /`\/cases\/\$\{encodeURIComponent\(caseId\)\}\?refresh=1#conversation`/);
});
