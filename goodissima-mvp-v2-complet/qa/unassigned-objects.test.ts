import assert from "node:assert/strict";
import test from "node:test";
import * as pagination from "../lib/unassigned-pagination.ts";
import * as creation from "../lib/object-creation.ts";
import * as candidateIdentity from "../lib/candidate-identity.ts";
import { loadTestModule } from "./helpers/load-test-module.ts";

function setup(user: string | null = "A") {
  const date = new Date("2026-09-01");
  const links = [
    { id: "simple", ownerId: "A", workspaceId: null, rules: { simpleLink: true } },
    { id: "opportunity", ownerId: "A", workspaceId: null, rules: { creationSource: "opportunity" } },
    { id: "legacy", ownerId: "A", workspaceId: null, rules: {} },
    { id: "foreign", ownerId: "B", workspaceId: null, rules: {} },
    { id: "attached", ownerId: "A", workspaceId: "WA", rules: {} },
  ].map(row => ({ ...row, title: row.id, createdAt: date }));
  const cases = ["simple", "foreign", "attached"].map((id, index) => ({ id: `case-${id}`, ownerId: index === 1 ? "B" : "A", workspaceId: index === 2 ? "WA" : null, gLinkId: id, candidateAccessToken: null, candidateName: id, candidateEmail: "", createdAt: date }));
  const templates = ["manual", "generated", "technical", "conflict", "foreign", "attached"].map(id => ({
    id, key: id, status: "DRAFT", name: id, createdAt: date, workspaceId: id === "attached" ? "WA" : null,
    workspace: id === "attached" ? { ownerId: "A" } : null,
    generations: id === "generated" || id === "conflict" ? [{ createdById: "A" }] : [],
    versions: [{ id: `version-${id}`, version: 1, snapshot: { metadata: id === "technical" ? { source: "simple-link" } : { source: "governance-v1-minimal-create", createdById: ["foreign", "conflict"].includes(id) ? "B" : "A", historical: "preserved" } } }],
    formTemplates: [{ id: `form-${id}`, name: id }],
  }));
  const workspaces = [{ id: "WA", ownerId: "A", status: "ACTIVE" }, { id: "WB", ownerId: "B", status: "ACTIVE" }, { id: "archive", ownerId: "A", status: "ARCHIVED" }].map(w => ({ ...w, name: w.id, slug: w.id, category: "OTHER", kind: "MIXED" }));
  const reads: any[] = [], writes: any[] = [], invalidated: string[] = [];
  const matches = (row: any, where: any): boolean => Object.entries(where).every(([key, value]: any) => value && typeof value === "object" ? key === "id" && value.in ? value.in.includes(row.id) : true : row[key] === value);
  const updateMany = (rows: any[]) => async ({ where, data }: any) => { const selected = rows.filter(r => matches(r, where)); selected.forEach(row => { writes.push({ id: row.id, data }); Object.assign(row, data); }); return { count: selected.length }; };
  const list = (rows: any[], model: string) => async (args: any) => {
    reads.push({ model, ...args }); assert.equal(args.take, 21); assert.ok(args.skip >= 0); assert.ok(args.orderBy.some((o: any) => o.id));
    assert.equal(args.where.ownerId, user); assert.equal(args.where.workspaceId, null);
    return rows.filter(r => matches(r, args.where)).sort((a,b) => a.id.localeCompare(b.id)).slice(args.skip, args.skip + args.take);
  };
  const prisma: any = {
    gLink: { findMany: list(links, "links"), findFirst: async ({ where, select }: any) => { const row = links.find(r => matches(r, where)); if (!row) return null; return { ...row, cases: select.cases.where.id ? [] : cases.filter(c => c.gLinkId === row.id && c.ownerId === user && c.workspaceId === null) }; }, updateMany: updateMany(links), update: async ({ where, data }: any) => updateMany(links)({ where, data }) },
    relationCase: { findMany: async (args: any) => (await list(cases, "cases")(args)).map(c => ({ ...c, gLink: links.find(l => l.id === c.gLinkId) })), findFirst: async ({ where }: any) => { const c = cases.find(c => matches(c, where)); return c ? { ...c, gLink: links.find(l => l.id === c.gLinkId) } : null; }, updateMany: updateMany(cases), update: async ({ where, data }: any) => updateMany(cases)({ where, data }) },
    relationTemplate: { findMany: async (args: any) => {
      reads.push({ model: "templates", ...args }); assert.equal(args.take, 21); assert.equal(args.where.workspaceId, null);
      assert.equal(args.where.OR[0].generations.some.createdById, user); assert.equal(args.select.formTemplates.take, 1);
      return templates.filter(t => !t.workspaceId && (t.generations.some(g => g.createdById === user) || (t.versions[0].snapshot.metadata.source === "governance-v1-minimal-create" && t.versions[0].snapshot.metadata.createdById === user))).slice(args.skip, args.skip + args.take);
    }, updateMany: updateMany(templates), update: async ({ where, data }: any) => updateMany(templates)({ where, data }) },
    formTemplate: { findUnique: async ({ where }: any) => { const t = templates.find(t => `form-${t.id}` === where.id); return t ? { id: where.id, relationTemplate: t } : null; } },
    templateGeneration: { findMany: async ({ where }: any) => templates.find(t => t.id === where.templateId)?.generations ?? [] },
    templateVersion: { findFirst: async ({ where }: any) => templates.find(t => t.id === where.templateId)?.versions[0], update: async ({ where, data }: any) => { writes.push({ id: where.id, data }); Object.assign(templates.flatMap(t => t.versions).find(v => v.id === where.id)!, data); } },
    workspace: {
      findMany: async (args: any) => { reads.push({ model: "workspaces", ...args }); assert.equal(args.take, 21); assert.deepEqual(args.where, { ownerId: user, status: "ACTIVE" }); return workspaces.filter(w => matches(w, args.where)).slice(args.skip, args.skip + args.take); },
      findFirst: async ({ where, select }: any) => { const w = workspaces.find(w => matches(w, where)); if (!w) return null; return !select.links ? w : { ...w, links: links.filter(l => matches(l, select.links.where)), relationCases: cases.filter(c => matches(c, select.relationCases.where)), relationTemplates: templates.filter(t => matches(t, select.relationTemplates.where)) }; },
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const deps: any = { "@/lib/prisma": { prisma }, "@/lib/object-creation": creation, "@/lib/candidate-identity": candidateIdentity, "@/lib/unassigned-pagination": pagination,
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!user) throw Error("LOGIN"); return { id: user }; } },
    "next/server": { NextResponse: { json: Response.json } }, "next/cache": { revalidatePath: (p: string) => invalidated.push(p) },
    "next/navigation": { redirect: (p: string) => { throw Error(`REDIRECT:${p}`); } }, "@/lib/workspace-portfolio-context": {},
  };
  deps["@/lib/relation-template-access"] = loadTestModule("lib/relation-template-access.ts", deps);
  deps["@/lib/template-mutation-access"] = loadTestModule("lib/template-mutation-access.ts", deps);
  const repository = loadTestModule("lib/governance-workspace-repository.ts", deps);
  deps["@/lib/governance-workspace-repository"] = repository;
  const actions = loadTestModule("lib/governance-workspace-actions.ts", deps);
  const detail = loadTestModule("lib/workspace-detail-repository.ts", deps);
  async function attach(kind: string, id: string, target = "WA", extra: Record<string,string> = {}) {
    const form = new FormData(); form.set("workspaceId", target); form.set("attachmentMode", "unassigned"); form.set("ownerId", "B");
    const field = kind === "journey" ? "formTemplateId" : kind === "case" ? "relationCaseId" : "gLinkId";
    form.set(field, id); for (const [k,v] of Object.entries(extra)) form.set(k,v);
    const action = kind === "journey" ? actions.attachGovernedJourneyToWorkspaceAction : kind === "case" ? actions.attachRelationCaseToWorkspaceAction : actions.attachGLinkToWorkspaceAction;
    try { await action(form); } catch (e) { if ((e as Error).message !== "REDIRECT:/gouvernance") throw e; }
  }
  return { repository, detail, attach, links, cases, templates, workspaces, reads, writes, invalidated };
}

test("visibility is owner scoped, unassigned only, and positively classified", async () => {
  const s = setup(); const links = await s.repository.getUnassignedGLinkSummaries("A");
  assert.deepEqual(links.items.map((r: any) => [r.id, r.objectLabel]), [["legacy", "Lien"], ["opportunity", "Opportunité"], ["simple", "Lien simple"]]);
  assert.deepEqual((await s.repository.getUnassignedRelationCaseSummaries("A")).items.map((r: any) => r.id), ["case-simple"]);
  assert.deepEqual((await s.repository.getUnassignedGovernedJourneySummaries("A")).items.map((r: any) => r.relationTemplateId), ["manual", "generated"]);
  assert.deepEqual((await s.repository.getGovernanceWorkspaceOptions("A", 0)).map((w: any) => w.id), ["WA"]);
  assert.equal(s.reads.length, 4);
});
test("unassigned dossier titles hide technical aliases and preserve real names", async () => {
  const hidden = setup();
  hidden.cases[0].candidateName = "";
  hidden.cases[0].candidateEmail = "private-case-simple@goodissima.local";
  assert.equal((await hidden.repository.getUnassignedRelationCaseSummaries("A")).items[0].title, "Candidat non identifié");
  const named = setup();
  named.cases[0].candidateName = "Hector";
  named.cases[0].candidateEmail = "private-case-simple@goodissima.local";
  assert.equal((await named.repository.getUnassignedRelationCaseSummaries("A")).items[0].title, "Hector");
});
for (const kind of ["link", "case", "journey"]) {
  const own = kind === "link" ? "simple" : kind === "case" ? "case-simple" : "form-manual";
  for (const target of ["WB", "archive", "missing", ""]) test(`${kind}: refuses target ${target || "empty"} without fallback`, async () => {
    const s = setup(); await assert.rejects(s.attach(kind, own, target)); assert.deepEqual(s.writes, []);
  });
  for (const id of [kind === "journey" ? "form-foreign" : kind === "case" ? "case-foreign" : "foreign", "missing"]) test(`${kind}: refuses object ${id}`, async () => {
    const s = setup(); await assert.rejects(s.attach(kind, id)); assert.deepEqual(s.writes, []);
  });
  test(`${kind}: requires session`, async () => { const s = setup(null); await assert.rejects(s.attach(kind, own), /LOGIN/); assert.deepEqual(s.writes, []); });
  test(`${kind}: stale attach cannot become an implicit move`, async () => {
    const s = setup(); const id = kind === "journey" ? "form-attached" : kind === "case" ? "case-attached" : "attached";
    await assert.rejects(s.attach(kind, id), /déjà rattaché/); assert.deepEqual(s.writes, []);
  });
  test(`${kind}: success disappears from collection and enters destination projection`, async () => {
    const s = setup(); await s.attach(kind, own);
    const list = kind === "journey" ? await s.repository.getUnassignedGovernedJourneySummaries("A") : kind === "case" ? await s.repository.getUnassignedRelationCaseSummaries("A") : await s.repository.getUnassignedGLinkSummaries("A");
    assert.ok(!list.items.some((r: any) => (r.formTemplateId || r.id) === own));
    const detail = await s.detail.getWorkspaceDetail("A", "WA");
    assert.ok((kind === "journey" ? detail.relationTemplates : kind === "case" ? detail.relationCases : detail.links).some((r: any) => r.id === (kind === "journey" ? "manual" : own)));
    assert.ok(s.invalidated.includes("/gouvernance")); assert.ok(s.invalidated.includes("/gouvernance/workspaces/WA"));
  });
}
test("conservative link attachment rejects a forged cascade option", async () => {
  const s = setup(); await s.attach("link", "simple", "WA", { attachUnassignedCases: "on" });
  assert.equal(s.cases[0].workspaceId, null); assert.deepEqual(s.writes.map(w => w.id), ["simple"]);
});
test("the historical explicit link cascade still attaches owned unassigned cases", async () => {
  const s = setup();
  await s.attach("link", "simple", "WA", { attachmentMode: "", attachUnassignedCases: "on" });
  assert.equal(s.cases[0].workspaceId, "WA");
  assert.deepEqual(s.writes.map(w => w.id), ["simple", "case-simple"]);
});
test("opportunity attachment preserves positive classification and its owner destination", async () => {
  const s = setup(); await s.attach("link", "opportunity");
  const workspace = await s.detail.getWorkspaceDetail("A", "WA");
  const opportunity = workspace.links.find((row: any) => row.id === "opportunity");
  assert.equal(creation.linkObjectLabel(opportunity.rules), "Opportunité");
  assert.ok(!(await s.repository.getUnassignedGLinkSummaries("A")).items.some((row: any) => row.id === "opportunity"));
});
test("case attachment preserves the documented parent cascade only", async () => {
  const s = setup(); await s.attach("case", "case-simple");
  assert.equal(s.links[0].workspaceId, "WA"); assert.deepEqual(s.writes.map(w => w.id), ["case-simple", "simple"]);
});
for (const state of ["foreign", "attached"]) test(`case never moves ${state} parent`, async () => {
  const s = setup(); if (state === "foreign") s.links[0].ownerId = "B"; else s.links[0].workspaceId = "WB";
  await s.attach("case", "case-simple"); assert.deepEqual(s.writes.map(w => w.id), ["case-simple"]);
});
test("journey updates organization metadata without changing business history or linked objects", async () => {
  const s = setup(); await s.attach("journey", "form-manual");
  assert.equal(s.templates[0].versions[0].snapshot.metadata.historical, "preserved");
  assert.deepEqual(s.writes.map(w => w.id), ["manual", "version-manual"]); assert.equal(s.links[0].workspaceId, null);
});
test("READ-only historical generated journey remains subject to its existing mutation constraint", async () => {
  const s = setup(); delete (s.templates[1].versions[0].snapshot.metadata as any).createdById;
  await assert.rejects(s.attach("journey", "form-generated"), /ne peut pas etre rattache/); assert.deepEqual(s.writes, []);
});
test("fixed windows, deterministic ordering and next page without duplicates", async () => {
  const s = setup(); for (let i = 0; i < 45; i++) s.links.push({ ...s.links[0], id: `extra-${String(i).padStart(2,"0")}` });
  const first = await s.repository.getUnassignedGLinkSummaries("A", 0), second = await s.repository.getUnassignedGLinkSummaries("A", 1);
  assert.equal(first.items.length, 20); assert.equal(first.hasMore, true); assert.equal(second.items.length, 20);
  assert.equal(new Set([...first.items, ...second.items].map(r => r.id)).size, 40); assert.equal(s.reads.length, 2);
});
test("rejected READ candidates do not hide the following page", async () => {
  const s = setup(); const conflict = s.templates.find(t => t.id === "conflict")!;
  s.templates.splice(0, s.templates.length, ...Array.from({length: 21}, (_,i) => ({...conflict, id: `conflict-${i}`})));
  const page = await s.repository.getUnassignedGovernedJourneySummaries("A"); assert.deepEqual(page.items, []); assert.equal(page.hasMore, true);
});
test("pagination rejects malformed, repeated, negative and excessive values", () => {
  for (const value of ["-1", "1e3", "abc", ["1","2"], "999999999", Infinity, undefined]) assert.equal(pagination.organizePage(value), 0);
  assert.equal(pagination.organizePage("2"), 2); assert.deepEqual(pagination.organizeWindow(2), {skip:40,take:21});
});
