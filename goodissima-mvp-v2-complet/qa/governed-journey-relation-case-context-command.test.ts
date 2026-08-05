import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const typesPath = new URL("../lib/governed-journey/context/types.ts", import.meta.url);
const repositoryPath = new URL("../lib/governed-journey/context/command-repository.ts", import.meta.url);
const servicePath = new URL("../lib/governed-journey/context/command-service.ts", import.meta.url);
const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const listRoutePath = new URL("../app/cases/[caseId]/journeys/page.tsx", import.meta.url);
const detailRoutePath = new URL("../app/cases/[caseId]/journeys/[journeyId]/page.tsx", import.meta.url);
const cockpitPath = new URL("../app/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url);

test("R1-C3 exposes one minimal attach command and result", async () => {
  const [types, service] = await Promise.all([readFile(typesPath, "utf8"), readFile(servicePath, "utf8")]);
  const result = types.match(/export type AttachGovernedJourneyRelationCaseContextResult = \{[\s\S]*?\n\};/)?.[0] ?? "";
  for (const field of ["governedJourneyId", "relationTemplateId", "relationCaseId", "createdAt", "created"]) assert.match(result, new RegExp(`\\b${field}\\b`));
  assert.match(service, /async attachRelationCaseContext\(input:/);
  assert.doesNotMatch(service, /\b(?:detach|remove|archive|replace|bulk|import|autoAttach)\w*\s*\(/i);
  assert.doesNotMatch(service, /createdByUserId:\s*input\./);
});

test("R1-C3 validates the active owned template before revealing extension absence", async () => {
  const repository = await readFile(repositoryPath, "utf8");
  assert.match(repository, /tx\.relationTemplate\.findFirst/);
  assert.match(repository, /id: input\.relationTemplateId,[\s\S]*workspaceId: input\.workspaceId,[\s\S]*ownerId: input\.requesterUserId, status: "ACTIVE"/);
  assert.ok(repository.indexOf('kind: "NOT_FOUND"') < repository.indexOf('kind: "GOVERNED_JOURNEY_EXTENSION_NOT_FOUND"'));
  assert.doesNotMatch(repository, /authorityUserId|metadata|Invitation|CommunicationSession|VIEW_MEMORY|VIEW_SOURCES/i);
});

test("R1-C3 requires an exact compatible RelationCase", async () => {
  const repository = await readFile(repositoryPath, "utf8");
  assert.match(repository, /tx\.relationCase\.findFirst/);
  for (const field of ["id: input.relationCaseId", "templateId: input.relationTemplateId", "workspaceId: input.workspaceId", "ownerId: input.requesterUserId"]) {
    assert.match(repository, new RegExp(field.replace(/[.]/g, "\\.")));
  }
  assert.doesNotMatch(repository, /candidateName|candidateEmail|gLinkId|title|formTemplateId/);
});

test("R1-C3 is serializable and exact repeats preserve the original row", async () => {
  const repository = await readFile(repositoryPath, "utf8");
  assert.match(repository, /isolationLevel: "Serializable"/);
  assert.ok(repository.indexOf("findUnique") < repository.indexOf("governedJourneyRelationCase.create"));
  assert.match(repository, /if \(exactContext\) return \{ kind: "EXISTING" as const, context: exactContext \}/);
  assert.match(repository, /createdByUserId: input\.requesterUserId/);
  assert.match(repository, /error\.code === "P2002"/);
  assert.match(repository, /validation\.kind === "EXISTING"/);
  assert.doesNotMatch(repository, /\.upsert\s*\(|while\s*\(|for\s*\(;;\)/);
});

test("R1-C3 maps conflicts and unexpected failures without Prisma leakage", async () => {
  const [repository, service] = await Promise.all([readFile(repositoryPath, "utf8"), readFile(servicePath, "utf8")]);
  for (const code of ["INVALID_INPUT", "NOT_FOUND", "GOVERNED_JOURNEY_EXTENSION_NOT_FOUND", "GOVERNED_JOURNEY_CONTEXT_CONFLICT", "GOVERNED_JOURNEY_CONTEXT_ATTACH_FAILED"]) {
    assert.match(service, new RegExp(`"${code}"`));
  }
  assert.match(repository, /error\.code === "P2003"/);
  assert.doesNotMatch(service, /error\.message|console\.|JSON\.stringify\(error/);
});

test("R1-C3 permits only one context write and no side effect", async () => {
  const [repository, schema, listRoute, detailRoute, cockpit] = await Promise.all([
    readFile(repositoryPath, "utf8"), readFile(schemaPath, "utf8"), readFile(listRoutePath, "utf8"),
    readFile(detailRoutePath, "utf8"), readFile(cockpitPath, "utf8"),
  ]);
  assert.equal((repository.match(/governedJourneyRelationCase\.create\s*\(/g) ?? []).length, 1);
  assert.doesNotMatch(repository, /\.(?:update|delete|upsert)\s*\(/);
  assert.doesNotMatch(repository, /governedJourney\.(?:create|update)|governedJourneyEvent|GovernedMemory|Invitation|CommunicationSession|Notification/i);
  assert.doesNotMatch(repository, /relationCaseId:\s*input\.relationCaseId[\s\S]*governedJourney\.(?:update|create)/);
  assert.match(schema, /relationCaseId String\?/);
  assert.match(listRoute, /notFound\(\)/);
  assert.match(detailRoute, /notFound\(\)/);
  assert.doesNotMatch(cockpit, /attachRelationCaseContext|GovernedJourneyRelationCaseContextCommand/);
});
