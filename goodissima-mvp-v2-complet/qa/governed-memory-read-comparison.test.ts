import assert from "node:assert/strict";
import test from "node:test";
import { compareMemoryStates } from "../lib/governed-memory/read/comparison.ts";

const base: any = { relationCaseId: "case-a", referenceDate: "2026-03-01T00:00:00Z", knowledgeMode: "KNOWN_AT_DATE", generatedAt: "2026-07-01T00:00:00Z", facts: [], decisions: [], sources: [], disputes: [], validations: [], timeline: [], access: [], roles: [], limitations: [], redactions: [] };

test("comparison distinguishes appearance, inapplicability and governed transitions", () => {
  const fact = { id: "fact-1", recordedAt: "2026-04-01T00:00:00Z", statusAtReference: "ESTABLISHED", disputeState: "NONE" };
  const decisionBefore = { id: "decision-1", statusAtReference: "VALIDATED" };
  const decisionAfter = { ...decisionBefore, statusAtReference: "CANCELLED", supersession: { recordedAt: "2026-06-01T00:00:00Z" } };
  const grantBefore = { id: "grant-1", stateAtReference: "ACTIVE" };
  const grantAfter = { id: "grant-1", stateAtReference: "REVOKED", revokedAt: "2026-05-01T00:00:00Z" };
  const changes = compareMemoryStates({ ...base, decisions: [decisionBefore], access: [grantBefore] } as never, { ...base, referenceDate: "2026-06-01T00:00:00Z", facts: [fact], decisions: [decisionAfter], access: [grantAfter] } as never);
  assert.equal(changes.factsAdded.length, 1);
  assert.equal(changes.decisionsCancelled.length, 1);
  assert.equal(changes.permissionsRevoked.length, 1);
  assert.equal(changes.permissionsRevoked[0].type, "PERMISSION_REVOKED");
});

test("comparison never calls a historical disappearance a physical deletion", () => {
  const changes = compareMemoryStates({ ...base, facts: [{ id: "fact-1" }] } as never, base);
  assert.equal(changes.factsRemovedFromEffectiveState[0].type, "FACT_BECAME_INAPPLICABLE");
});
