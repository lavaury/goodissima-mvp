import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { loadTestModule } from "./helpers/load-test-module.ts";

const systemId = "rel_tpl_default_secure_conversation";
function setup(userId: string | null = "A") {
  const row = (id: string, owner: string | null, creators: string[] = [], initial?: string) => ({
    id, key: id, status: "DRAFT", isDefault: false, workspaceId: owner ? `W${owner}` : null,
    workspace: owner ? { ownerId: owner } : null,
    generations: creators.map(createdById => ({ createdById })),
    versions: initial ? [{ snapshot: { metadata: { source: "governance-v1-minimal-create", createdById: initial } } }] : [],
  });
  const rows = new Map([
    row("TA", "A"), row("TB", "B"), row("TA0", null, ["A"]), row("TB0", null, ["B"]),
    row("unknown", null), row("conflict", null, ["A"], "B"), row("initialA", null, [], "A"),
    row("twoCreators", null, ["A", "B"]), row("foreignWithMetadataA", "B", [], "A"),
    { ...row("defaultFlag", null), isDefault: true },
    { ...row(systemId, null), key: "DEFAULT_SECURE_CONVERSATION", isDefault: true },
    { ...row("forgedKey", null), key: "DEFAULT_SECURE_CONVERSATION", isDefault: true },
    { ...row("archivedA", "A"), status: "ARCHIVED" },
  ].map(template => [template.id, template]));
  const writes: unknown[] = [];
  const effects: string[] = [];
  const reads: string[] = [];
  const prisma = {
    relationTemplate: {
      findUnique: async ({ where }: any) => rows.get(where.id) ?? null,
      findMany: async ({ select, where }: any) => {
        assert.equal(select.generations.take, 2);
        assert.deepEqual(select.generations.distinct, ["createdById"]);
        assert.deepEqual(select.generations.where, { status: "VALIDATED", validatedAt: { not: null } });
        assert.deepEqual(select.versions.where, { version: 1 });
        assert.equal(where.OR[0].workspace.ownerId, userId);
        assert.equal(where.OR[1].workspaceId, null);
        // Return a superset to ensure contradictory/foreign rows are never exposed.
        return [...rows.values()];
      },
    },
    formTemplate: {
      findUnique: async ({ where, select }: any) => {
        if (!select) throw Error("UNAUTHORIZED_DETAIL_READ");
        reads.push("proof");
        const template = rows.get(where.id);
        return template ? { id: where.id, relationTemplate: template } : null;
      },
      findMany: async ({ where }: any) => where.relationTemplateId.in.map((id: string) => ({ id })),
    },
    templateGeneration: { findMany: async ({ where }: any) => rows.get(where.templateId)?.generations ?? [] },
    templateVersion: { findFirst: async ({ where }: any) => {
      assert.equal(where.version, 1); return rows.get(where.templateId)?.versions[0] ?? null;
    } },
    gLink: { create: async ({ data }: any) => { writes.push(data); return { id: "new-link", ...data }; } },
  };
  const dependencies: Record<string, any> = {
    "react/jsx-runtime": {},
    "@/lib/prisma": { prisma },
    "next/server": { NextResponse: { json: Response.json } },
    "next/cache": { unstable_noStore() {}, revalidatePath() {} },
    "next/navigation": { notFound() { throw Error("404"); } },
    "@/lib/auth": { getCurrentPrismaUser: async () => {
      if (!userId) throw Error("LOGIN"); return { id: userId, email: "owner@example.test" };
    } },
    "@/lib/i18n": { getI18n: () => ({ locale: "fr", t: (s: string) => s }) },
    "@/lib/audit": { auditLog: async () => { effects.push("audit"); } },
    "@/lib/email": { sendSecureLinkCreatedEmail: async () => { effects.push("email"); } },
    "@/lib/slug": { slugify: () => "title" },
    "@/lib/secure-link-admission": { parseSecureLinkAdmissionMode: () => "OPEN" },
    "@/lib/public-app-url": { buildPublicAppUrl: (p: string) => `https://example.test${p}` },
    "@/lib/template-snapshots": { getActiveTemplateVersion: async (id: string) => {
      effects.push("version"); return { id: `version-${id}` };
    } },
  };
  const access = loadTestModule<typeof import("../lib/relation-template-access")>("lib/relation-template-access.ts", dependencies);
  dependencies["@/lib/relation-template-access"] = access;
  const mutation = loadTestModule<typeof import("../lib/template-mutation-access")>("lib/template-mutation-access.ts", dependencies);
  const route = loadTestModule<typeof import("../app/api/links/route")>("app/api/links/route.ts", dependencies);
  async function create(templateId: unknown, extra: Record<string, unknown> = {}) {
    return route.POST(new Request("https://example.test/api/links", { method: "POST", body: JSON.stringify({ title: "Test", templateId, suppressNotification: true, ...extra }) }));
  }
  function module(file: string) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const imports = Object.fromEntries(ts.preProcessFile(source).importedFiles.map(file => [file.fileName, {}]));
    return loadTestModule<any>(file, { ...imports, ...dependencies });
  }
  return { rows, access, mutation, create, writes, effects, reads, module, dependencies, prisma };
}

for (const [id, allowed] of [
  ["TA", true], ["TB", false], ["TA0", true], ["TB0", false], ["unknown", false],
  ["conflict", false], ["initialA", true], ["twoCreators", false], ["foreignWithMetadataA", false],
  ["defaultFlag", false], ["forgedKey", false], ["missing", false],
] as const) {
  test(`READ A / ${id}: ${allowed}`, async () => {
    const s = setup();
    assert.equal(Boolean(await s.access.getTemplateReadAccess({ id: "A" }, id)), allowed);
    assert.deepEqual(s.writes, []);
  });
  test(`USE real POST A / ${id}: ${allowed}`, async () => {
    const s = setup(); const before = structuredClone(s.rows);
    const response = await s.create(id, { ownerId: "B", isDefault: true, confirm: true });
    assert.equal(response.status, allowed ? 200 : 404);
    assert.deepEqual(s.rows, before);
    if (allowed) {
      assert.equal((s.writes[0] as any).ownerId, "A");
      assert.equal((s.writes[0] as any).templateId, id);
      assert.deepEqual(s.effects, ["version", "audit"]);
    } else {
      assert.deepEqual(await response.json(), { error: "Parcours introuvable." });
      assert.deepEqual(s.writes, []); assert.deepEqual(s.effects, []);
    }
  });
}

test("seeded system template: USE only, no cockpit READ or MUTATE", async () => {
  const s = setup();
  assert.equal(await s.access.getTemplateReadAccess({ id: "A" }, systemId), null);
  assert.equal(await s.mutation.getTemplateMutationAccess({ id: "A" }, systemId), null);
  assert.equal((await s.create(systemId)).status, 200);
  assert.equal((await s.create(undefined)).status, 200);
  assert.equal((s.writes[1] as any).templateId, systemId);
});

test("system fallback refuses missing, archived, foreign-attached or contradictory seed", async () => {
  for (const variant of ["missing", "archived", "foreign", "contradiction"]) {
    const s = setup(); const row = s.rows.get(systemId)!;
    if (variant === "missing") s.rows.delete(systemId);
    if (variant === "archived") row.status = "ARCHIVED";
    if (variant === "foreign") { row.workspaceId = "WB"; row.workspace = { ownerId: "B" }; }
    if (variant === "contradiction") row.generations = [{ createdById: "A" }, { createdById: "B" }];
    assert.equal((await s.create(undefined)).status, 404);
    assert.deepEqual(s.writes, []); assert.deepEqual(s.effects, []);
  }
});

test("READ ownership proof stays equivalent to DEBT-AUTH-01 without altering its guard", async () => {
  const s = setup();
  for (const user of ["A", "B"]) for (const id of s.rows.keys()) {
    assert.equal(Boolean(await s.access.getTemplateReadAccess({ id: user }, id)),
      Boolean(await s.mutation.getTemplateMutationAccess({ id: user }, id)), `${user}/${id}`);
  }
});

test("exact system id does not grant USE with a wrong key or another user's personal provenance", async () => {
  for (const variant of ["wrongKey", "personalGeneration", "personalInitialVersion"]) {
    const s = setup(); const template = s.rows.get(systemId)!;
    if (variant === "wrongKey") template.key = "ANOTHER_TEMPLATE";
    if (variant === "personalGeneration") template.generations = [{ createdById: "B" }];
    if (variant === "personalInitialVersion") template.versions = [{ snapshot: { metadata: { source: "governance-v1-minimal-create", createdById: "B" } } }];
    for (const selection of [systemId, undefined]) assert.equal((await s.create(selection)).status, 404);
    assert.equal(await s.access.getTemplateReadAccess({ id: "A" }, systemId), null);
    assert.equal(await s.mutation.getTemplateMutationAccess({ id: "A" }, systemId), null);
    assert.deepEqual(s.writes, []); assert.deepEqual(s.effects, []);
  }
});

test("B can read/use B and cannot impersonate A", async () => {
  const s = setup("B");
  assert.ok(await s.access.getTemplateReadAccess({ id: "B" }, "TB0"));
  assert.equal((await s.create("TB")).status, 200);
  assert.equal((await s.create("TA", { ownerId: "A" })).status, 404);
});

test("archived owned template remains readable but cannot create a new link", async () => {
  const s = setup(); assert.ok(await s.access.getTemplateReadAccess({ id: "A" }, "archivedA"));
  assert.equal((await s.create("archivedA")).status, 404); assert.deepEqual(s.writes, []);
});

test("invalid explicit selection never becomes a default template", async () => {
  for (const value of ["", "   ", 1, {}, []]) {
    const s = setup(); assert.equal((await s.create(value)).status, 400); assert.deepEqual(s.effects, []);
  }
});

test("anonymous POST stops before permission reads or writes", async () => {
  const s = setup(null); await assert.rejects(s.create("TA"), /LOGIN/);
  assert.deepEqual(s.writes, []); assert.deepEqual(s.effects, []);
});

test("catalogue IDs match API USE; READ catalogue excludes system/foreign/unknown", async () => {
  const s = setup();
  assert.deepEqual((await s.access.getAccessibleRelationTemplateIds("A")).sort(), ["TA", "TA0", "archivedA", "initialA"].sort());
  const usable = await s.access.getAccessibleRelationTemplateIds("A", "use");
  assert.deepEqual(usable.sort(), ["TA", "TA0", "initialA", systemId].sort());
  for (const id of usable) assert.equal((await s.create(id)).status, 200);
  const result = await s.module("app/api/templates/route.ts").GET();
  assert.deepEqual((await result.json()).map((r: any) => r.id).sort(), ["TA", "TA0", "archivedA", "initialA"].sort());
});

for (const file of ["app/(connected)/templates/[templateId]/page.tsx", "app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx"]) {
  test(`${file}: foreign/unknown/contradictory reads stop before detail loading`, async () => {
    const s = setup();
    for (const id of ["TB", "TB0", "unknown", "conflict", "foreignWithMetadataA", "missing"]) {
      await assert.rejects(s.module(file).default({ params: { id, templateId: id } }), /^Error: 404$/);
    }
  });
}

test("consolidation refuses metadata claiming A on B's Workspace before detail loading", async () => {
  const s = setup();
  const result = await s.module("lib/governance-cockpit-consolidation-repository.ts").getGovernanceCockpitConsolidation({ ownerId: "A", formTemplateId: "foreignWithMetadataA" });
  assert.equal(result, null); assert.deepEqual(s.reads, ["proof"]);
});

test("version selection and validated generation filters are strict for single-object READ", async () => {
  const s = setup();
  s.prisma.formTemplate.findUnique = async ({ select }: any) => {
    assert.deepEqual(select.relationTemplate.select.versions.where, { version: 1 });
    assert.deepEqual(select.relationTemplate.select.generations.where, { status: "VALIDATED", validatedAt: { not: null } });
    return { id: "TA0", relationTemplate: s.rows.get("TA0")! };
  };
  assert.ok(await s.access.getTemplateReadAccess({ id: "A" }, "TA0"));
});

test("orphan list uses initial ownership, includes validated creator, and ignores latest author", async () => {
  const s = setup(); const proofQuery = s.prisma.relationTemplate.findMany;
  let queries = 0;
  s.prisma.relationTemplate.findMany = async (args: any) => {
    queries++;
    if (args.select) return proofQuery(args);
    assert.equal(args.where.workspaceId, null);
    const ids = args.where.id.in;
    assert.ok(ids.includes("TA0")); assert.ok(ids.includes("initialA"));
    assert.ok(!ids.includes("TB0")); assert.ok(!ids.includes("conflict"));
    return [...s.rows.values()].filter(row => row.workspaceId === null && ids.includes(row.id)).map(row => ({
      ...row, name: row.id, formTemplates: [{ id: row.id, name: row.id }],
      versions: [{ createdAt: new Date("2026-09-01"), snapshot: { metadata: { source: "later-edit", createdById: "B" } } }],
    }));
  };
  const result = await s.module("lib/governance-workspace-repository.ts").getUnassignedGovernedJourneySummaries("A");
  assert.deepEqual(result.map((row: any) => row.relationTemplateId).sort(), ["TA0", "initialA"]);
  assert.equal(queries, 2);
  assert.ok(result.every((row: any) => row.href === `/gouvernance/parcours/${row.formTemplateId}/pilotage`));
});

test("archive repository intersects its historical cohort with READ permission", async () => {
  const s = setup(); const proofQuery = s.prisma.relationTemplate.findMany;
  s.prisma.relationTemplate.findMany = async (args: any) => {
    if (args.select?.generations) return proofQuery(args);
    assert.deepEqual(args.where.AND[1].id.in.sort(), ["TA", "TA0", "initialA", "archivedA"].sort());
    return [];
  };
  Object.assign(s.prisma.gLink, { count: async () => 0 });
  Object.assign(s.prisma, { $transaction: async (queries: Promise<unknown>[]) => Promise.all(queries) });
  s.dependencies["@/lib/archived-opportunity"] = s.module("lib/archived-opportunity.ts");
  assert.deepEqual(await s.module("lib/archived-opportunity-repository.ts").getArchivedOpportunitySummaryForOwner("A"), { count: 0, journeys: [] });
});

test("metadata without the trusted creation source, malformed metadata and dangling Workspace deny READ/USE", async () => {
  for (const variant of ["otherSource", "array", "dangling"]) {
    const s = setup(); const template = s.rows.get("initialA")!;
    if (variant === "otherSource") template.versions[0].snapshot.metadata.source = "later-edit";
    if (variant === "array") (template.versions[0].snapshot as any).metadata = ["A"];
    if (variant === "dangling") template.workspaceId = "missing-workspace";
    assert.equal(await s.access.getTemplateReadAccess({ id: "A" }, "initialA"), null);
    assert.equal((await s.create("initialA")).status, 404);
    assert.deepEqual(s.writes, []);
  }
});
