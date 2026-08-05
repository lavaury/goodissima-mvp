import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("R1-B scopes every read through an active owned Workspace", async () => {
  const repository = await readFile(new URL("../lib/governed-journey/read/repository.ts", import.meta.url), "utf8");
  assert.match(repository, /workspaceId,[\s\S]*ownerId: requesterUserId, status: "ACTIVE"/);
  assert.equal((repository.match(/activeOwnedWorkspace\(input\.workspaceId, input\.requesterUserId\)/g) ?? []).length, 3);
  assert.doesNotMatch(repository, /RelationCase|relationCase\.find|ownerId: input\.requesterUserId/);
  assert.doesNotMatch(repository, /authorityUserId|VIEW_MEMORY|VIEW_SOURCES|governedJourneyInvitation|communicationSession|meetingParticipant/i);
});

test("R1-B projections exclude authority, memory and lifecycle internals", async () => {
  const repository = await readFile(new URL("../lib/governed-journey/read/repository.ts", import.meta.url), "utf8");
  const select = repository.match(/export const internalGovernedJourneyLedgerSelect = \{[\s\S]*?\n\}/)?.[0] ?? "";
  for (const field of ["id", "relationTemplateId", "relationCaseId", "status", "createdAt", "updatedAt"]) assert.match(select, new RegExp(`\\b${field}\\b`));
  for (const forbidden of ["title", "authorityUserId", "currentStepKey", "version", "startedAt", "suspendedAt", "closedAt", "cancelledAt", "memorySources"]) {
    assert.doesNotMatch(select, new RegExp(`\\b${forbidden}\\b`));
  }
  assert.doesNotMatch(repository, /GovernedMemory|memorySource/i);
  assert.doesNotMatch(repository, /\.(create|update|delete|upsert)\s*\(/);
});

test("R1-B errors are stable and non-discriminating", async () => {
  const service = await readFile(new URL("../lib/governed-journey/read/service.ts", import.meta.url), "utf8");
  for (const code of ["INVALID_INPUT", "NOT_FOUND", "LEGACY_EVENT_LOG_UNAVAILABLE", "GOVERNED_JOURNEY_READ_FAILED"]) {
    assert.match(service, new RegExp(`"${code}"`));
  }
  assert.match(service, /catch \(error\)[\s\S]*GOVERNED_JOURNEY_READ_FAILED/);
  assert.doesNotMatch(service, /error\.message|JSON\.stringify\(error|console\./);
});
