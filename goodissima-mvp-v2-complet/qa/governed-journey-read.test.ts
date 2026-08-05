import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryPath = new URL("../lib/governed-journey/read/repository.ts", import.meta.url);
const servicePath = new URL("../lib/governed-journey/read/service.ts", import.meta.url);
const typesPath = new URL("../lib/governed-journey/read/types.ts", import.meta.url);

test("R1-B exposes only bounded structural lookups as the primary read model", async () => {
  const [repository, service] = await Promise.all([readFile(repositoryPath, "utf8"), readFile(servicePath, "utf8")]);
  for (const method of ["findOptionalByRelationTemplateId", "findOptionalByFormTemplateId"]) {
    assert.match(repository, new RegExp(`${method}\\(`));
    assert.match(service, new RegExp(`${method}\\(`));
  }
  assert.doesNotMatch(service, /async (?:list|detail)\(/);
  assert.doesNotMatch(repository, /findMany|take:|cursor|updatedAt: "desc"/);
  assert.doesNotMatch(repository, /include:/);
});

test("RelationTemplate lookup returns an optional minimal ledger extension", async () => {
  const repository = await readFile(repositoryPath, "utf8");
  assert.match(repository, /database\.relationTemplate\.findFirst/);
  assert.match(repository, /id: input\.relationTemplateId/);
  assert.match(repository, /governedJourney: \{ select: internalGovernedJourneyLedgerSelect \}/);
  assert.match(repository, /row \? \{ ledger: row\.governedJourney \} : null/);
});

test("FormTemplate resolution follows its RelationTemplate and derives title from FormTemplate name", async () => {
  const repository = await readFile(repositoryPath, "utf8");
  assert.match(repository, /database\.formTemplate\.findFirst/);
  assert.match(repository, /id: input\.formTemplateId/);
  assert.match(repository, /relationTemplate: activeOwnedWorkspace/);
  assert.match(repository, /title: row\.name/);
  assert.match(repository, /ledger: row\.relationTemplate\.governedJourney/);
  assert.doesNotMatch(repository, /formTemplateId: input\.formTemplateId[\s\S]*database\.governedJourney/);
});

test("the DTO names technical status and keeps legacy nullable context explicit", async () => {
  const types = await readFile(typesPath, "utf8");
  const ledger = types.match(/export type InternalGovernedJourneyLedgerView = \{[\s\S]*?\n\};/)?.[0] ?? "";
  for (const field of ["id", "relationTemplateId", "relationCaseId", "ledgerStatus", "createdAt", "updatedAt", "createdFromTemplateVersionNumber"]) {
    assert.match(ledger, new RegExp(`\\b${field}\\b`));
  }
  assert.match(ledger, /relationCaseId: string \| null/);
  for (const forbidden of ["title", "status:", "authorityUserId", "actorUserId", "currentStepKey", "startedAt", "suspendedAt", "closedAt", "cancelledAt", "visibleMemorySourceCount"]) {
    assert.doesNotMatch(ledger, new RegExp(forbidden));
  }
  assert.match(types, /ledgerStatus[^\n]*not the operational journey's business status/);
});

test("legacy events remain explicitly case-scoped and sequence ordered", async () => {
  const [repository, service] = await Promise.all([readFile(repositoryPath, "utf8"), readFile(servicePath, "utf8")]);
  assert.match(repository, /listLegacyEvents/);
  assert.match(repository, /where: \{ relationCaseId: input\.relationCaseId \}/);
  assert.match(repository, /orderBy: \{ sequence: "asc" \}/);
  assert.match(repository, /journey\.relationCaseId === null[\s\S]*LEGACY_EVENT_LOG_UNAVAILABLE/);
  assert.match(repository, /journey\.relationCaseId !== input\.relationCaseId[\s\S]*NOT_FOUND/);
  assert.match(service, /LEGACY_EVENT_LOG_UNAVAILABLE/);
});
