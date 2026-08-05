import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const action = read("lib/governance-journey-actions.ts");
const creationRequestRepository = read("lib/governed-journey/creation-request-repository.ts");
const extension = read("lib/governed-journey/create-extension.ts");
const cockpit = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");
const listRoute = read("app/cases/[caseId]/journeys/page.tsx");
const detailRoute = read("app/cases/[caseId]/journeys/[journeyId]/page.tsx");

test("R2 validates the final human payload and rejects client-controlled GJ structure", () => {
  for (const field of ["governedJourneyId", "relationTemplateId", "formTemplateId", "createdFromTemplateVersionId", "authorityUserId", "relationCaseId", "status", "currentStepKey", "createdByUserId"]) {
    assert.match(action, new RegExp(`"${field}"`));
  }
  assert.match(action, /forbiddenStructuralFields\.some\(\(field\) => formData\.has\(field\)\)/);
  assert.match(action, /new GovernanceJourneyCreationError\("INVALID_INPUT"\)/);
  assert.match(action, /name: boundedText\(formData, "name", 2, 120\)/);
  assert.match(action, /initialNeed: boundedText\(formData, "initialNeed", 10, 2_000\)/);
  assert.match(action, /requiresHumanValidation: true/);
  assert.doesNotMatch(action, /textFromForm\(formData, "requiresHumanValidation"\)/);
});

test("Workspace resolution is owner-scoped, active and never reactivates an archived row", () => {
  assert.match(action, /id: workspaceId,[\s\S]*ownerId: owner\.id,[\s\S]*status: "ACTIVE"/);
  assert.match(action, /ownerId_slug: \{ ownerId: owner\.id, slug: workspaceSlug \}/);
  assert.match(action, /workspace\.status !== "ACTIVE"/);
  assert.match(action, /workspace\.ownerId !== owner\.id/);
  assert.doesNotMatch(action, /tx\.workspace\.upsert/);
  assert.doesNotMatch(action, /update:\s*\{\s*status: "ACTIVE"/);
});

test("the operational objects, exact version and extension share one transaction in that order", () => {
  const ordered = [
    "tx.workspace", "tx.relationTemplate.create", "tx.formTemplate.create", "tx.formField.createMany",
    "tx.templateVersion.create", "createGovernedJourneyExtensionInTransaction",
  ];
  let offset = action.indexOf("prisma.$transaction");
  assert.ok(offset >= 0);
  for (const marker of ordered) {
    const next = action.indexOf(marker, offset);
    assert.ok(next > offset, `${marker} must be inside the transaction and in order`);
    offset = next;
  }
  assert.match(action, /const templateVersion = await tx\.templateVersion\.create/);
  assert.match(action, /templateVersionId: templateVersion\.id/);
  assert.doesNotMatch(action, /MAX\(|templateVersion\.findFirst/);
});

test("the R2 extension contains only the technical creation snapshot and no side effect", () => {
  for (const expected of [
    "relationTemplateId", "formTemplateId", "createdFromTemplateVersionId: templateVersionId",
    "authorityUserId", "relationCaseId: null", "title", 'status: "DRAFT"', "version: 1",
    "currentStepKey: null", "startedAt: null", "suspendedAt: null", "closedAt: null", "cancelledAt: null",
  ]) assert.ok(extension.includes(expected), `missing ${expected}`);
  assert.doesNotMatch(extension, /GovernedJourneyEvent|governedJourneyEvent|GovernedJourneyRelationCase|governedJourneyRelationCase|memory|invitation|session|notification|communication|contact|media|openai|mistral/i);
  assert.doesNotMatch(extension, /\$transaction/);
  assert.match(action, /authorityUserId: workspace\.ownerId/);
  assert.match(action, /title: createdFormTemplate\.name/);
});

test("errors are stable and the cockpit contract remains FormTemplate-based", () => {
  for (const code of ["INVALID_INPUT", "NOT_FOUND", "CREATION_CONFLICT", "GOVERNED_JOURNEY_CREATION_FAILED"]) assert.ok(action.includes(`"${code}"`));
  assert.match(creationRequestRepository, /error\.code === "P2002"/);
  assert.match(action, /redirect\(`\/gouvernance\/parcours\/\$\{formTemplateId\}\/pilotage`\)/);
  assert.match(cockpit, /prisma\.formTemplate\.findUnique/);
  assert.doesNotMatch(cockpit, /prisma\.governedJourney\.(?:find|create|update|delete)/);
});

test("GJ-4 remains an immediate 404 and R2 adds no route or migration", () => {
  const immediateNotFound = /^import \{ notFound \} from "next\/navigation";\s+export default function \w+\(\) \{\s+notFound\(\);\s+\}\s*$/;
  assert.match(listRoute, immediateNotFound);
  assert.match(detailRoute, immediateNotFound);
  assert.doesNotMatch(`${action}\n${extension}`, /governedJourneyEvent\.create|governedJourneyRelationCase\.create|governedMemory|invitation\.create|communicationSession\.create|notification\.create/i);
});
