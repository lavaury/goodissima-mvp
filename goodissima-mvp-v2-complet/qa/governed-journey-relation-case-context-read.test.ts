import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const typesPath = new URL("../lib/governed-journey/context/types.ts", import.meta.url);
const repositoryPath = new URL("../lib/governed-journey/context/repository.ts", import.meta.url);
const servicePath = new URL("../lib/governed-journey/context/service.ts", import.meta.url);
const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const listRoutePath = new URL("../app/cases/[caseId]/journeys/page.tsx", import.meta.url);
const detailRoutePath = new URL("../app/cases/[caseId]/journeys/[journeyId]/page.tsx", import.meta.url);
const cockpitPath = new URL("../app/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url);

test("R1-C2 projects only structural context identifiers", async () => {
  const [types, repository] = await Promise.all([readFile(typesPath, "utf8"), readFile(repositoryPath, "utf8")]);
  const view = types.match(/export type GovernedJourneyRelationCaseContextView = \{[\s\S]*?\n\};/)?.[0] ?? "";
  for (const field of ["governedJourneyId", "relationTemplateId", "relationCaseId", "createdAt"]) assert.match(view, new RegExp(`\\b${field}\\b`));
  for (const forbidden of ["createdByUserId", "ownerId", "title", "status", "authorityUserId", "currentStepKey", "memory", "event", "candidate", "email"]) {
    assert.doesNotMatch(view, new RegExp(forbidden, "i"));
  }
  const select = repository.match(/export const governedJourneyRelationCaseContextSelect = \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(select, /createdByUserId|ownerId|title|status|authorityUserId/i);
});

test("R1-C2 lists contexts through an active owned RelationTemplate Workspace", async () => {
  const repository = await readFile(repositoryPath, "utf8");
  assert.match(repository, /database\.relationTemplate\.findFirst/);
  assert.match(repository, /id: input\.relationTemplateId/);
  assert.match(repository, /workspaceId,[\s\S]*ownerId: requesterUserId, status: "ACTIVE"/);
  assert.match(repository, /createdAt: "asc"[\s\S]*relationCaseId: "asc"/);
  assert.match(repository, /contexts: template\.governedJourney\?\.relationCaseContexts \?\? \[\]/);
  assert.doesNotMatch(repository, /database\.relationCase|relationCase:\s*\{/);
});

test("R1-C2 resolves FormTemplate only through its RelationTemplate", async () => {
  const repository = await readFile(repositoryPath, "utf8");
  assert.match(repository, /database\.formTemplate\.findFirst/);
  assert.match(repository, /id: input\.formTemplateId/);
  assert.match(repository, /relationTemplate: activeOwnedWorkspace/);
  assert.match(repository, /formTemplate\.relationTemplate\.governedJourney\?\.relationCaseContexts \?\? \[\]/);
  assert.doesNotMatch(repository, /formTemplateId: input\.formTemplateId[\s\S]*database\.governedJourney/);
});

test("R1-C2 returns stable errors and contains no mutation contract", async () => {
  const [repository, service] = await Promise.all([readFile(repositoryPath, "utf8"), readFile(servicePath, "utf8")]);
  for (const method of ["listByRelationTemplateId", "listByFormTemplateId"]) assert.match(service, new RegExp(`${method}\\(`));
  for (const code of ["INVALID_INPUT", "NOT_FOUND", "GOVERNED_JOURNEY_CONTEXT_READ_FAILED"]) assert.match(service, new RegExp(`"${code}"`));
  assert.doesNotMatch(`${repository}\n${service}`, /\.(?:create|update|delete|upsert)\s*\(/);
  assert.doesNotMatch(service, /\b(?:attach|detach|archive)\w*\s*\(/i);
  assert.doesNotMatch(`${repository}\n${service}`, /GovernedMemory|governedJourneyEvent|Invitation|CommunicationSession|VIEW_MEMORY|VIEW_SOURCES/i);
});

test("R1-C2 ignores the legacy case and changes no schema, route or cockpit", async () => {
  const [repository, schema, listRoute, detailRoute, cockpit] = await Promise.all([
    readFile(repositoryPath, "utf8"), readFile(schemaPath, "utf8"), readFile(listRoutePath, "utf8"),
    readFile(detailRoutePath, "utf8"), readFile(cockpitPath, "utf8"),
  ]);
  assert.doesNotMatch(repository, /governedJourney:\s*\{[\s\S]{0,200}relationCaseId:\s*true/);
  assert.match(schema, /relationCaseId String\?/);
  assert.match(listRoute, /notFound\(\)/);
  assert.match(detailRoute, /notFound\(\)/);
  assert.doesNotMatch(cockpit, /relationCaseContexts|GovernedJourneyRelationCaseContext/);
});
