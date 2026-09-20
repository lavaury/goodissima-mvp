import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canCandidateWriteInRelation, canWriteInRelation } from "../lib/relation-governance.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ownerRoutes = ["livekit-token", "protected-call", "protected-call/started", "session-usage"];
const candidateRoutes = ownerRoutes;

test("only ACTIVE can obtain or start owner and candidate dossier media", () => {
  assert.equal(canWriteInRelation("ACTIVE"), true);
  assert.equal(canCandidateWriteInRelation("ACTIVE"), true);
  for (const status of ["SUSPENDED", "CLOSED", "BLOCKED"]) {
    assert.equal(canWriteInRelation(status), false);
    assert.equal(canCandidateWriteInRelation(status), false);
  }
  for (const route of ownerRoutes) {
    const text = source(`app/api/cases/[caseId]/media/${route}/route.ts`);
    assert.match(text, /ownerId: owner\.id/);
    assert.match(text, /governanceStatus: true/);
    assert.match(text, /canWriteInRelation/);
    assert.match(text, /status: 409/);
  }
  for (const route of candidateRoutes) {
    const text = source(`app/api/candidate/cases/[caseId]/media/${route}/route.ts`);
    assert.match(text, /activeCandidateAccessWhere\(candidateAccessToken\)/);
    assert.match(text, /governanceStatus: true/);
    assert.match(text, /canCandidateWriteInRelation/);
    assert.match(text, /status: 409/);
  }
});

test("signaling blocks continuation but preserves leave-only cleanup", () => {
  for (const prefix of ["app/api/cases", "app/api/candidate/cases"]) {
    const text = source(`${prefix}/[caseId]/media/signaling/route.ts`);
    assert.match(text, /message\.type !== "leave"/);
    assert.match(text, /outgoing\.length === 0/);
    assert.match(text, /status: 409/);
  }
});

test("owner end route remains governance-independent teardown", () => {
  const text = source("app/api/cases/[caseId]/media/protected-call/end/route.ts");
  assert.match(text, /status: "COMPLETED"/);
  assert.match(text, /clearRelationMediaSignals/);
  assert.doesNotMatch(text, /canWriteInRelation|governanceStatus/);
});

test("expired and revoked candidate tokens remain checked before governance", () => {
  const helper = source("lib/candidate-access.ts");
  assert.match(helper, /candidateAccessRevokedAt: null/);
  assert.match(helper, /candidateAccessExpiresAt/);
});
