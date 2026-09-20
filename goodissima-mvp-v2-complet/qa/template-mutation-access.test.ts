import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { loadTestModule } from "./helpers/load-test-module.ts";

type Row = {
  id: string; relationTemplate: {
    id: string; workspaceId: string | null; workspace: { ownerId: string } | null;
    status: string; key: string; name: string; description: null;
    _count: { links: number; relationCases: number };
  }; name: string; description: null; fields: Array<Record<string, unknown>>;
};
function setup(user: string | null = "A") {
  const row = (id: string, owner: string | null): Row => ({
    id, name: id, description: null, fields: [{ key: "name", label: "Nom", type: "TEXT", required: true, step: 1, position: 1, options: null, validationRules: null, conditionalRules: null }],
    relationTemplate: { id: `relation-${id}`, workspaceId: owner ? `workspace-${owner}` : null, workspace: owner ? { ownerId: owner } : null, status: "DRAFT", key: id, name: id, description: null, _count: { links: 0, relationCases: 0 } },
  });
  const rows = new Map([row("A", "A"), row("B", "B"), row("historical", null)].map(row => [row.id, row]));
  const writes: Array<{ model: string; data: unknown }> = [];
  const reads: string[] = [];
  const generations: Array<{ templateId: string; createdById: string; status: string; validatedAt: Date | null }> = [];
  const versions: Array<{ templateId: string; version: number; snapshot: unknown }> = [];
  const workspaces = [ { id: "workspace-A", ownerId: "A", status: "ACTIVE" }, { id: "workspace-B", ownerId: "B", status: "ACTIVE" }, { id: "archived-A", ownerId: "A", status: "ARCHIVED" } ];
  let activeLinks = 0;
  const prisma = {
    formTemplate: {
      findUnique: async ({ where }: { where: { id: string } }) => { reads.push("form"); return rows.get(where.id) ?? null; },
      delete: async ({ where }: { where: { id: string } }) => { writes.push({ model: "form.delete", data: where }); rows.delete(where.id); },
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ model: "form.create", data }); return { id: "copy-form", ...data }; },
    },
    relationTemplate: {
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        writes.push({ model: "relation.update", data });
        const row = [...rows.values()].find(row => row.relationTemplate.id === where.id);
        assert.ok(row); Object.assign(row.relationTemplate, data); return row.relationTemplate;
      },
      delete: async ({ where }: { where: { id: string } }) => { writes.push({ model: "relation.delete", data: where }); },
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ model: "relation.create", data }); return { id: "copy-relation", ...data }; },
    },
    templateGeneration: { findMany: async ({ where, distinct, take }: { where: { templateId: string; status: string; validatedAt: { not: null } }; distinct: string[]; take: number }) => {
      reads.push("generation"); assert.deepEqual(distinct, ["createdById"]); assert.equal(take, 2); assert.deepEqual(where.validatedAt, { not: null });
      return [...new Map(generations.filter(g => g.templateId === where.templateId && g.status === where.status && g.validatedAt !== null).map(g => [g.createdById, { createdById: g.createdById }])).values()].slice(0, take);
    } },
    templateVersion: {
      findFirst: async ({ where }: { where: { templateId: string; version: number } }) => { reads.push("version"); assert.equal(where.version, 1); return versions.find(v => v.templateId === where.templateId && v.version === where.version) ?? null; },
      update: async (data: unknown) => { writes.push({ model: "version.update", data }); },
    },
    workspace: { findFirst: async ({ where }: { where: { id: string; ownerId: string; status: string } }) => {
      reads.push("workspace"); return workspaces.find(w => w.id === where.id && w.ownerId === where.ownerId && w.status === where.status) ?? null;
    } },
    gLink: { count: async () => { reads.push("links"); return activeLinks; } },
    formField: {
      createMany: async ({ data }: { data: unknown }) => { writes.push({ model: "fields.create", data }); },
      findUnique: async ({ where }: { where: { id: string } }) => { reads.push("field"); return rows.has(where.id) ? { formTemplateId: where.id } : null; },
    },
    $transaction: async <T>(operation: (tx: unknown) => Promise<T>): Promise<T> => operation(prisma),
  };
  const dependencies: Record<string, unknown> = {
    "@/lib/prisma": { prisma }, "next/server": { NextResponse: { json: Response.json } },
    "@prisma/client": { Prisma: { JsonNull: null } },
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!user) throw Error("NEXT_REDIRECT:/login"); return { id: user }; } },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect: (path: string) => { throw Error(`NEXT_REDIRECT:${path}`); } },
  };
  const access = loadTestModule<typeof import("../lib/template-mutation-access")>("lib/template-mutation-access.ts", dependencies);
  dependencies["@/lib/template-mutation-access"] = access;
  function handler(path: string, method = "POST") {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    const imports = Object.fromEntries(ts.preProcessFile(source).importedFiles.map(file => [file.fileName, {}]));
    // Every external dependency is doubled. Unknown side effects fail if called.
    return loadTestModule<Record<string, (request: Request, context: { params: { templateId: string; fieldId: string; reportId: string; optimizationId: string } }) => Promise<Response>>>(path, { ...imports, ...dependencies }, { console: { error() {} } })[method];
  }
  async function call(operation: "archive" | "delete" | "duplicate", id: string, body?: unknown) {
    const path = `app/api/templates/[templateId]/${operation === "delete" ? "" : `${operation}/`}route.ts`;
    return invoke(handler(path, operation === "delete" ? "DELETE" : "POST"), id, body);
  }
  const attachment = loadTestModule<{ attachGovernedJourneyToWorkspaceAction(form: FormData): Promise<void>; changeGovernedJourneyWorkspaceAction(form: FormData): Promise<void> }>("lib/governance-workspace-actions.ts", {
    "@/lib/governance-workspace-repository": {}, "@/lib/workspace-portfolio-context": {}, ...dependencies,
  });
  return { rows, writes, reads, generations, versions, workspaces, access, handler, call, attachment, activeLinks: (value: number) => { activeLinks = value; } };
}
function invoke(handler: ReturnType<ReturnType<typeof setup>["handler"]>, id: string, body?: unknown) {
  return handler(new Request("https://example.test/api/templates", { method: "POST", ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }), { params: { templateId: id, fieldId: id, reportId: "report", optimizationId: "optimization" } });
}

for (const operation of ["archive", "delete", "duplicate"] as const) {
  test(`A ${operation} A succeeds and leaves B unchanged`, async () => {
    const s = setup(); const b = structuredClone(s.rows.get("B"));
    const response = await s.call(operation, "A", { workspaceId: "workspace-A" });
    assert.equal(response.status, operation === "duplicate" ? 201 : 200);
    assert.deepEqual(s.rows.get("B"), b); assert.ok(s.writes.length > 0);
    if (operation === "archive") assert.equal(s.rows.get("A")?.relationTemplate.status, "ARCHIVED");
    if (operation === "delete") assert.deepEqual(s.writes.map(w => w.model), ["form.delete", "relation.delete"]);
    if (operation === "duplicate") {
      const data = s.writes.find(w => w.model === "relation.create")?.data as Record<string, unknown>;
      assert.equal(data.workspaceId, "workspace-A"); assert.equal(data.status, "DRAFT");
      assert.equal((await response.json()).relationTemplateId, "copy-relation");
    }
  });
  for (const id of ["B", "missing", "historical"]) {
    test(`A ${operation} ${id} is a safe 404 even with confirmation and owned target`, async () => {
      const s = setup(); const before = structuredClone(s.rows); s.activeLinks(8);
      const response = await s.call(operation, id, { confirm: true, workspaceId: "workspace-A", ownerId: "A", isDefault: true });
      assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: "Parcours introuvable." });
      assert.deepEqual(s.writes, []); assert.deepEqual(s.rows, before); assert.ok(!s.reads.includes("links"));
    });
  }
  test(`anonymous ${operation} refuses before template reads and writes`, async () => {
    const s = setup(null); await assert.rejects(s.call(operation, "A"), /NEXT_REDIRECT/);
    assert.deepEqual(s.reads, []); assert.deepEqual(s.writes, []);
  });
  test(`validated historical creator can ${operation} their template`, async () => {
    const s = setup(); s.generations.push({ templateId: "relation-historical", createdById: "A", status: "VALIDATED", validatedAt: new Date() });
    assert.equal((await s.call(operation, "historical", { workspaceId: "workspace-A" })).status, operation === "duplicate" ? 201 : 200);
  });
  test(`foreign historical creator cannot be impersonated for ${operation}`, async () => {
    const s = setup(); s.generations.push({ templateId: "relation-historical", createdById: "B", status: "VALIDATED", validatedAt: new Date() });
    assert.equal((await s.call(operation, "historical", { confirm: true, workspaceId: "workspace-A" })).status, 404);
    assert.deepEqual(s.writes, []);
  });
  test(`B can ${operation} B: authorization is not tied to the fixture user A`, async () => {
    const s = setup("B"); assert.equal((await s.call(operation, "B", { workspaceId: "workspace-B" })).status, operation === "duplicate" ? 201 : 200);
  });
}

test("archive retains active-link confirmation without granting foreign access", async () => {
  const s = setup(); s.activeLinks(3);
  assert.equal((await s.call("archive", "A", { confirm: false })).status, 409); assert.deepEqual(s.writes, []);
  assert.equal((await s.call("archive", "A", { confirm: true })).status, 200);
});

test("delete retains status and usage constraints before either deletion", async () => {
  for (const variant of ["PUBLISHED", "ARCHIVED", "links", "relationCases"]) {
    const s = setup(); const relation = s.rows.get("A")!.relationTemplate;
    if (variant === "links" || variant === "relationCases") relation._count[variant] = 1;
    else relation.status = variant;
    assert.equal((await s.call("delete", "A")).status, 409); assert.deepEqual(s.writes, []);
  }
});

test("copy requires explicit active owned destination without a fallback", async () => {
  for (const [body, status] of [[undefined, 409], [{}, 409], [{ workspaceId: "" }, 400], [{ workspaceId: 1 }, 400], [{ workspaceId: "workspace-B" }, 404], [{ workspaceId: "archived-A" }, 404], [{ workspaceId: "missing" }, 404]] as const) {
    const s = setup(); assert.equal((await s.call("duplicate", "A", body)).status, status); assert.deepEqual(s.writes, []);
  }
});

test("copy uses the explicit owned target without changing the source", async () => {
  const s = setup(); const original = structuredClone(s.rows.get("A"));
  s.workspaces.push({ id: "another-A", ownerId: "A", status: "ACTIVE" });
  assert.equal((await s.call("duplicate", "A", { workspaceId: "another-A" })).status, 201);
  assert.equal((s.writes.find(w => w.model === "relation.create")?.data as { workspaceId: string }).workspaceId, "another-A");
  assert.deepEqual(s.rows.get("A"), original);
});

test("another owner's Workspace cannot be bypassed by historical provenance", async () => {
  const s = setup(); s.generations.push({ templateId: "relation-B", createdById: "A", status: "VALIDATED", validatedAt: new Date() });
  assert.equal(await s.access.getTemplateMutationAccess({ id: "A" }, "B"), null);
  assert.ok(!s.reads.includes("generation"));
});

test("original governed creator is accepted but contradictory or unvalidated evidence is refused", async () => {
  const s = setup();
  s.versions.push({ templateId: "relation-historical", version: 1, snapshot: { metadata: { source: "governance-v1-minimal-create", createdById: "A" } } });
  assert.ok(await s.access.getTemplateMutationAccess({ id: "A" }, "historical"));
  s.generations.push({ templateId: "relation-historical", createdById: "B", status: "VALIDATED", validatedAt: new Date() });
  assert.equal(await s.access.getTemplateMutationAccess({ id: "A" }, "historical"), null);
  s.versions.length = 0; s.generations[0] = { templateId: "relation-historical", createdById: "A", status: "GENERATED", validatedAt: null };
  assert.equal(await s.access.getTemplateMutationAccess({ id: "A" }, "historical"), null);
  s.versions.push({ templateId: "relation-historical", version: 2, snapshot: { metadata: { createdById: "A", source: "governance-v1-minimal-create" } } });
  assert.equal(await s.access.getTemplateMutationAccess({ id: "A" }, "historical"), null);
});

test("isDefault and detached objects carry no implicit access, missing relations fail closed", async () => {
  const s = setup(); Object.assign(s.rows.get("historical")!.relationTemplate, { isDefault: true });
  assert.equal(await s.access.getTemplateMutationAccess({ id: "A" }, "historical"), null);
  Object.assign(s.rows.get("A")!.relationTemplate, { workspace: null });
  assert.equal(await s.access.getTemplateMutationAccess({ id: "A" }, "A"), null);
  Object.assign(s.rows.get("historical")!, { relationTemplate: null });
  assert.equal(await s.access.getTemplateMutationAccess({ id: "A" }, "historical"), null);
});

for (const [suffix, method] of [["publish", "POST"], ["lifecycle", "POST"], ["ai-instructions", "PATCH"], ["fields", "POST"], ["manual-versions", "POST"], ["critic", "POST"], ["critic/[reportId]/optimize", "POST"], ["optimizations/[optimizationId]/approve", "POST"]]) {
  test(`neighbor ${suffix} denies a foreign template before business calls`, async () => {
    const s = setup(); const response = await invoke(s.handler(`app/api/templates/[templateId]/${suffix}/route.ts`, method), "B", { humanConfirmed: true, humanApproved: true });
    assert.equal(response.status, 404); assert.deepEqual(s.writes, []); assert.deepEqual(s.reads, ["form"]);
  });
}
for (const method of ["PATCH", "DELETE"]) {
  test(`field ${method} resolves the template owner and refuses B`, async () => {
    const s = setup(); const response = await invoke(s.handler("app/api/templates/fields/[fieldId]/route.ts", method), "B");
    assert.equal(response.status, 404); assert.deepEqual(s.writes, []); assert.deepEqual(s.reads, ["field", "form"]);
  });
}

test("Workspace reassignment cannot launder a foreign template through legacy metadata", async () => {
  for (const change of [false, true]) {
    const s = setup();
    Object.assign(s.rows.get("B")!.relationTemplate, { versions: [{ id: "version-B", snapshot: { metadata: { createdById: "A" } } }] });
    const form = new FormData(); form.set("formTemplateId", "B"); form.set("workspaceId", "workspace-A"); form.set("humanConfirmed", "yes");
    const action = change ? s.attachment.changeGovernedJourneyWorkspaceAction : s.attachment.attachGovernedJourneyToWorkspaceAction;
    await assert.rejects(action(form), /ne peut pas etre rattache/);
    assert.deepEqual(s.writes, []); assert.deepEqual(s.reads, ["form"]);
  }
});

test("owned governed Workspace attachment preserves its existing success flow", async () => {
  const s = setup();
  Object.assign(s.rows.get("A")!.relationTemplate, { versions: [{ id: "version-A", snapshot: { metadata: { createdById: "A" } } }] });
  const form = new FormData(); form.set("formTemplateId", "A"); form.set("workspaceId", "workspace-A");
  await assert.rejects(s.attachment.attachGovernedJourneyToWorkspaceAction(form), /NEXT_REDIRECT:\/gouvernance/);
  assert.deepEqual(s.writes.map(w => w.model), ["relation.update", "version.update"]);
});
