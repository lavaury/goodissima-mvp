import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  authorizedFormFieldWhere,
  authorizedFormTemplateScopeWhere,
  authorizedFormTemplateWhere,
  authorizedMutableFormFieldWhere,
  authorizedMutableFormTemplateWhere,
  resolveAuthorizedFormField,
  resolveAuthorizedFormTemplate,
  resolveTemplateWorkspaceDestination,
} from "../lib/template-authorization.ts";

const read = (path: string) => readFileSync(path, "utf8");
const users = { a: "user-a", b: "user-b" } as const;
const templates = [
  { id: "template-a", ownerId: users.a },
  { id: "template-b", ownerId: users.b },
];
const fields = [
  { id: "field-a", formTemplateId: "template-a" },
  { id: "field-b", formTemplateId: "template-b" },
];

function requesterFromTemplateWhere(where: any) {
  return where.relationTemplate.is.OR[0].workspace.is.ownerId as string;
}

const database = {
  formTemplate: {
    async findFirst({ where }: any) {
      const row = templates.find((template) => template.id === where.id);
      return row?.ownerId === requesterFromTemplateWhere(where)
        ? { id: row.id, relationTemplateId: `relation-${row.id}`, relationTemplate: { id: `relation-${row.id}`, workspaceId: `workspace-${row.ownerId}` } }
        : null;
    },
  },
  formField: {
    async findFirst({ where }: any) {
      const field = fields.find((candidate) => candidate.id === where.id);
      const template = templates.find((candidate) => candidate.id === field?.formTemplateId);
      const requester = requesterFromTemplateWhere(where.formTemplate.is);
      return field && template?.ownerId === requester ? field : null;
    },
  },
} as any;

test("user A can resolve template A but learns nothing about template B", async () => {
  assert.equal((await resolveAuthorizedFormTemplate("template-a", users.a, database))?.id, "template-a");
  assert.equal(await resolveAuthorizedFormTemplate("template-b", users.a, database), null);
});

test("field authorization always climbs through FormTemplate ownership", async () => {
  assert.equal((await resolveAuthorizedFormField("field-a", users.a, database))?.id, "field-a");
  assert.equal(await resolveAuthorizedFormField("field-b", users.a, database), null);
  const where = authorizedFormFieldWhere("field-b", users.a) as any;
  assert.equal(where.formTemplate.is.relationTemplate.is.OR[0].workspace.is.ownerId, users.a);
});

test("canonical scope proves Workspace ownership independently of lifecycle and legacy access is explicit", () => {
  const where = authorizedFormTemplateWhere("template-a", users.a) as any;
  assert.equal(where.id, "template-a");
  assert.deepEqual(where.relationTemplate.is.OR[0], { workspace: { is: { ownerId: users.a } } });
  assert.deepEqual(where.relationTemplate.is.OR[1], { workspaceId: null, governedJourney: { is: { authorityUserId: users.a } }, governedJourneyCreationRequest: { is: null } });
  assert.deepEqual(where.relationTemplate.is.OR[2], { workspaceId: null, governedJourney: { is: null }, governedJourneyCreationRequest: { is: { requesterUserId: users.a } } });
  assert.deepEqual(where.relationTemplate.is.OR[3], { workspaceId: null, governedJourney: { is: { authorityUserId: users.a } }, governedJourneyCreationRequest: { is: { requesterUserId: users.a } } });
  assert.equal((authorizedFormTemplateScopeWhere(users.a) as any).relationTemplate.is.OR.length, 4);
});

test("Workspace-backed mutations require ACTIVE without changing legacy proof rules", () => {
  const readable = authorizedFormTemplateWhere("template-a", users.a) as any;
  const mutable = authorizedMutableFormTemplateWhere("template-a", users.a) as any;
  assert.deepEqual(readable.relationTemplate.is.OR[0], { workspace: { is: { ownerId: users.a } } });
  assert.deepEqual(mutable.relationTemplate.is.OR[0], { workspace: { is: { ownerId: users.a, status: "ACTIVE" } } });
  assert.deepEqual(mutable.relationTemplate.is.OR.slice(1), readable.relationTemplate.is.OR.slice(1));
  assert.equal((authorizedMutableFormFieldWhere("field-a", users.a) as any).formTemplate.is.relationTemplate.is.OR[0].workspace.is.status, "ACTIVE");
});

test("legacy identical proofs authorize while contradictory proofs match neither user", () => {
  const alternatives = (authorizedFormTemplateScopeWhere(users.a) as any).relationTemplate.is.OR;
  const bothPresent = alternatives[3];
  assert.equal(bothPresent.governedJourney.is.authorityUserId, users.a);
  assert.equal(bothPresent.governedJourneyCreationRequest.is.requesterUserId, users.a);
  assert.notEqual(users.a, users.b);
  assert.equal(
    bothPresent.governedJourney.is.authorityUserId === users.a &&
      bothPresent.governedJourneyCreationRequest.is.requesterUserId === users.b,
    false,
  );
});

function workspaceDatabase(rows: Array<{ id: string; ownerId: string; status: "ACTIVE" | "ARCHIVED"; name: string }>) {
  return {
    workspace: {
      async findMany({ where, take }: any) {
        return rows
          .filter((row) => (!where.id || row.id === where.id) && row.ownerId === where.ownerId && row.status === where.status)
          .slice(0, take)
          .map(({ id, name }) => ({ id, name }));
      },
    },
  } as any;
}

test("workspace destination refuses zero and ambiguous active Workspaces", async () => {
  assert.deepEqual(await resolveTemplateWorkspaceDestination(users.a, null, workspaceDatabase([])), { kind: "ZERO" });
  const many = workspaceDatabase([
    { id: "workspace-a1", ownerId: users.a, status: "ACTIVE", name: "A1" },
    { id: "workspace-a2", ownerId: users.a, status: "ACTIVE", name: "A2" },
  ]);
  assert.deepEqual(await resolveTemplateWorkspaceDestination(users.a, null, many), { kind: "MULTIPLE" });
});

test("workspace destination automatically resolves exactly one active Workspace", async () => {
  const db = workspaceDatabase([{ id: "workspace-a", ownerId: users.a, status: "ACTIVE", name: "A" }]);
  assert.deepEqual(await resolveTemplateWorkspaceDestination(users.a, null, db), {
    kind: "RESOLVED", workspace: { id: "workspace-a", name: "A" }, source: "SINGLE",
  });
});

test("explicit destination accepts an owned active Workspace and rejects foreign or archived targets", async () => {
  const db = workspaceDatabase([
    { id: "workspace-a", ownerId: users.a, status: "ACTIVE", name: "A" },
    { id: "workspace-a-old", ownerId: users.a, status: "ARCHIVED", name: "A old" },
    { id: "workspace-b", ownerId: users.b, status: "ACTIVE", name: "B" },
  ]);
  assert.equal((await resolveTemplateWorkspaceDestination(users.a, "workspace-a", db)).kind, "RESOLVED");
  assert.deepEqual(await resolveTemplateWorkspaceDestination(users.a, "workspace-a-old", db), { kind: "INVALID_SELECTION" });
  assert.deepEqual(await resolveTemplateWorkspaceDestination(users.a, "workspace-b", db), { kind: "INVALID_SELECTION" });
});

test("template page and list use the shared server-side scope", () => {
  assert.match(read("app/templates/[templateId]/page.tsx"), /authorizedFormTemplateWhere\(params\.templateId, owner\.id\)/);
  assert.match(read("app/templates/page.tsx"), /authorizedFormTemplateScopeWhere\(owner\.id\)/);
  assert.match(read("app/api/templates/route.ts"), /authorizedFormTemplateScopeWhere\(owner\.id\)/);
});

test("all template mutations reject cross-owner IDs through the canonical scope", () => {
  const guardedRoutes = [
    "app/api/templates/[templateId]/route.ts",
    "app/api/templates/[templateId]/fields/route.ts",
    "app/api/templates/[templateId]/ai-instructions/route.ts",
    "app/api/templates/[templateId]/archive/route.ts",
    "app/api/templates/[templateId]/critic/route.ts",
    "app/api/templates/[templateId]/critic/[reportId]/optimize/route.ts",
    "app/api/templates/[templateId]/duplicate/route.ts",
    "app/api/templates/[templateId]/lifecycle/route.ts",
    "app/api/templates/[templateId]/manual-versions/route.ts",
    "app/api/templates/[templateId]/optimizations/[optimizationId]/approve/route.ts",
    "app/api/templates/[templateId]/publish/route.ts",
  ];
  for (const path of guardedRoutes) {
    const source = read(path);
    assert.match(source, /authorizedMutableFormTemplateWhere|resolveAuthorizedMutableFormTemplate|authorizedFormTemplateWhere/, path);
    assert.match(source, /owner\.id/, path);
  }
});

test("user A cannot create, modify or delete a field belonging to user B", () => {
  const create = read("app/api/templates/[templateId]/fields/route.ts");
  const mutate = read("app/api/templates/fields/[fieldId]/route.ts");
  assert.ok(create.indexOf("resolveAuthorizedMutableFormTemplate") < create.indexOf("formField.create"));
  assert.equal((mutate.match(/resolveAuthorizedMutableFormField/g) ?? []).length >= 3, true);
  assert.ok(mutate.indexOf("resolveAuthorizedMutableFormField") < mutate.indexOf("formField.update"));
  assert.ok(mutate.lastIndexOf("resolveAuthorizedMutableFormField") < mutate.indexOf("formField.delete"));
});

test("new, duplicated and AI-validated templates use the canonical Workspace destination", () => {
  const collection = read("app/api/templates/route.ts");
  const duplicate = read("app/api/templates/[templateId]/duplicate/route.ts");
  const generated = read("app/api/templates/ai-generate/[generationId]/validate/route.ts");
  assert.match(collection, /resolveTemplateWorkspaceDestination/);
  assert.match(collection, /workspaceId: destination\.workspace\.id/);
  assert.match(duplicate, /destinationWorkspaceId/);
  assert.match(duplicate, /workspaceId: destinationWorkspaceId/);
  assert.match(duplicate, /template\.relationTemplate\.workspace\.status !== "ACTIVE"/);
  assert.match(generated, /resolveTemplateWorkspaceDestination/);
  assert.match(generated, /workspaceId: destination\.workspace\.id/);
});

test("no creation path silently selects the first active Workspace", () => {
  const authorization = read("lib/template-authorization.ts");
  assert.doesNotMatch(authorization, /workspace\.findFirst/);
  assert.match(authorization, /take: 2/);
});

test("Studio and AI validation require an explicit choice when several Workspaces are available", () => {
  const studio = read("components/NewTemplateButton.tsx");
  const ai = read("components/AITemplateDesigner.tsx");
  assert.match(studio, /workspaces\.length > 1 && !workspaceId/);
  assert.match(ai, /workspaces\.length > 1 && !workspaceId/);
  assert.match(studio, /workspaceId: workspaceId \|\| undefined/);
  assert.match(ai, /workspaceId: workspaceId \|\| undefined/);
});

test("legacy duplication requires a destination while active Workspace duplication preserves its parent", () => {
  const duplicate = read("app/api/templates/[templateId]/duplicate/route.ts");
  assert.match(duplicate, /destinationWorkspaceId = template\.relationTemplate\.workspace\.id/);
  assert.match(duplicate, /resolveTemplateWorkspaceDestination/);
  assert.match(duplicate, /WORKSPACE_SELECTION_REQUIRED/);
});
