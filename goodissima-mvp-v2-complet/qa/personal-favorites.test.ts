import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { objectActionRow } from "./helpers/object-action-row.ts";
import { renderShellFixture } from "./helpers/render-connected-shell.ts";
import * as targets from "../lib/personal-favorite-target.ts";
import * as classification from "../lib/object-creation.ts";
import * as spatial from "../lib/spatial-navigation.ts";

const read = (file: string) => readFileSync(file, "utf8");
const access = loadTestModule("lib/relation-template-access.ts", { "@/lib/prisma": { prisma: {} } });
const target = (objectKind = "PORTFOLIO", objectId = "p") => ({ objectKind, objectId });
function fixture(data: Record<string, any[]> = {}) {
  let userId = "alice";
  const calls: any[] = [], invalidated: string[] = [];
  const saved = new Map<string, any>();
  const key = (r: any) => JSON.stringify([r.userId, r.objectKind, r.objectId]);
  const prisma: any = Object.fromEntries(["portfolio", "workspace", "gLink", "relationTemplate", "relationCase"].map(model => [model, {
    findMany: async (args: any) => {
      calls.push({ model, args });
      assert.ok(args.take > 0 && args.take <= 20);
      return (data[model] ?? []).filter(row => args.where.id.in.includes(row.id) && (!args.where.ownerId || row.ownerId === args.where.ownerId)).slice(0, args.take);
    },
  }]));
  prisma.personalFavorite = {
    findUnique: async (args: any) => { calls.push({ model: "favorite-state", args }); return saved.get(key(args.where.userId_objectKind_objectId)) ?? null; },
    createMany: async (args: any) => { calls.push({ model: "add", args }); assert.equal(args.skipDuplicates, true); for (const r of args.data) if (!saved.has(key(r))) saved.set(key(r), { ...r, createdAt: new Date() }); },
    deleteMany: async (args: any) => { calls.push({ model: "remove", args }); saved.delete(key(args.where)); },
    findMany: async (args: any) => { calls.push({ model: "list", args }); return [...saved.values()].filter(r => r.userId === args.where.userId).slice(args.skip, args.skip + args.take).map(({ objectKind, objectId }) => ({ objectKind, objectId })); },
  };
  const repository = loadTestModule("lib/personal-favorites-repository.ts", {
    "@/lib/prisma": { prisma }, "@/lib/personal-favorite-target": targets,
    "@/lib/object-creation": classification, "@/lib/spatial-navigation": spatial, "@/lib/relation-template-access": access,
  });
  const actions = loadTestModule("lib/personal-favorites-actions.ts", {
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!userId) throw Error("LOGIN"); return { id: userId }; } },
    "next/cache": { unstable_noStore() {}, revalidatePath(path: string) { invalidated.push(path); } },
    "@/lib/prisma": { prisma }, "@/lib/personal-favorite-target": targets, "@/lib/personal-favorites-repository": repository,
  });
  return { ...actions, repository, calls, saved, invalidated, as: (id: string) => { userId = id; } };
}
const journey = (id: string, extra = {}) => ({ id, key: id, workspaceId: null, workspace: null, status: "ACTIVE",
  generations: [{ createdById: "alice" }], versions: [], formTemplates: [{ id: `form-${id}`, name: "Voyage" }], ...extra });

test("schema and dedicated migration contain only minimal personal references and User FK", () => {
  const schema = read("prisma/schema.prisma");
  const model = schema.match(/model PersonalFavorite \{([\s\S]*?)\n\}/)![1];
  assert.match(model, /@@id\(\[userId, objectKind, objectId\]\)/);
  assert.match(model, /@@index\(\[userId, createdAt\]\)/);
  assert.match(model, /user User @relation\(fields: \[userId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/);
  assert.doesNotMatch(model, /title|url|token|snapshot|workspaceId/i);
  assert.match(schema, /personalFavorites\s+PersonalFavorite\[\]/);
  const sql = read("prisma/migrations/20260909120000_add_personal_favorites/migration.sql");
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 1);
  assert.equal((sql.match(/REFERENCES/g) ?? []).length, 1);
  assert.match(sql, /REFERENCES "User"\("id"\)/);
  assert.match(sql, /PRIMARY KEY \("userId","objectKind","objectId"\)/);
  assert.doesNotMatch(sql, /^\s*(?:DROP|UPDATE |DELETE FROM|ALTER TABLE "(?:User|Workspace|GLink|RelationCase|RelationTemplate)")/m);
  for (const kind of ["PORTFOLIO", "WORKSPACE", "GLINK", "RELATION_TEMPLATE", "RELATION_CASE"]) assert.ok(sql.includes(`'${kind}'`));
});

test("add is concurrent/idempotent, stores only session user and minimal fields", async () => {
  const f = fixture({ portfolio: [{ id: "p", ownerId: "alice", name: "Projet" }] });
  const input = { ...target(), userId: "bob", href: "https://evil", title: "ignored" };
  assert.deepEqual(await Promise.all([f.addFavorite(input), f.addFavorite(input)]), [{ ok: true }, { ok: true }]);
  assert.equal(f.saved.size, 1);
  const first = [...f.saved.values()][0];
  await f.addFavorite(input);
  assert.equal([...f.saved.values()][0], first);
  assert.deepEqual(Object.keys(first).sort(), ["createdAt", "objectId", "objectKind", "userId"]);
  assert.equal(first.userId, "alice");
  assert.deepEqual(await f.getFavoriteState(target()), { available: true, saved: true });
});

test("removal is idempotent and cannot remove another user's reference", async () => {
  const f = fixture({ portfolio: [{ id: "p", ownerId: "alice", name: "Projet" }] });
  await f.addFavorite(target());
  f.as("bob");
  await f.removeFavorite({ ...target(), userId: "alice" });
  assert.equal(f.saved.size, 1);
  f.as("alice");
  assert.deepEqual(await f.removeFavorite(target()), { ok: true });
  assert.deepEqual(await f.removeFavorite(target()), { ok: true });
  assert.equal(f.saved.size, 0);
});

test("inaccessible, deleted and malformed targets do not authorize an add or reveal state", async () => {
  const data = { portfolio: [{ id: "p", ownerId: "alice", name: "Private" }] };
  const f = fixture(data);
  await f.addFavorite(target());
  data.portfolio[0].ownerId = "bob";
  assert.deepEqual(await f.listFavorites(), { items: [], hasMore: false, page: 0 });
  assert.deepEqual(await f.getFavoriteState(target()), { available: false, saved: false });
  assert.deepEqual(await f.addFavorite(target()), { ok: false });
  data.portfolio.length = 0;
  assert.equal((await f.listFavorites()).items.length, 0);
  assert.equal(f.saved.size, 1, "hidden references are retained");
  for (const value of [null, target("INVALID"), target("GLINK", "../secret"), target("GLINK", "https://public"), target("GLINK", ""), target("GLINK", "x".repeat(192))]) assert.deepEqual(await f.addFavorite(value), { ok: false });
  await f.removeFavorite(target());
  assert.equal(f.saved.size, 0, "removal does not require target access");
});

test("five types resolve in grouped owner/READ queries with no extra object lookups", async () => {
  const f = fixture({ portfolio: [{ id: "p", ownerId: "alice", name: "Projet" }], workspace: [{ id: "w", ownerId: "alice", name: "Espace" }],
    gLink: [{ id: "s", ownerId: "alice", title: "Simple", rules: { simpleLink: true } }, { id: "o", ownerId: "alice", title: "Offre", rules: { creationSource: "opportunity" } }],
    relationTemplate: [journey("t")], relationCase: [{ id: "c", ownerId: "alice", candidateName: "Dossier test" }] });
  const refs = [target(), target("WORKSPACE", "w"), target("GLINK", "s"), target("GLINK", "o"), target("RELATION_TEMPLATE", "t"), target("RELATION_CASE", "c")];
  const rows = await f.repository.resolveFavorites("alice", refs);
  assert.deepEqual(rows.map((r: any) => r.label), ["Portfolio", "Workspace", "Lien simple", "Opportunité", "Parcours gouverné", "Dossier"]);
  assert.equal(f.calls.length, 5);
  for (const call of f.calls) {
    assert.equal(call.args.include, undefined);
    if (call.model === "relationTemplate") {
      assert.deepEqual(call.args.where.OR, [{ workspace: { ownerId: "alice" } }, access.getTemplateCreationProofWhere("alice")]);
      assert.deepEqual(call.args.select.generations, access.templateAccessSelect.generations);
      assert.equal(call.args.select.formTemplates.take, 1);
    } else assert.equal(call.args.where.ownerId, "alice");
  }
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ["href", "label", "objectId", "objectKind", "title"]);
    assert.doesNotMatch(row.href, /[?#]|https?:|\/secure\/|\/invitation\/|\/l\//);
  }
  assert.equal(rows[4].href, "/gouvernance/parcours/form-t/pilotage");
});

test("READ rejects foreign/conflicting/system templates and missing or unsafe form destinations", async () => {
  const ts = [journey("mine"), journey("owned", { workspaceId: "w", workspace: { ownerId: "alice" }, generations: [] }),
    journey("foreign", { workspaceId: "w", workspace: { ownerId: "bob" } }), journey("conflict", { generations: [{ createdById: "alice" }, { createdById: "bob" }] }),
    journey("snapshot", { versions: [{ snapshot: { metadata: { source: "governance-v1-minimal-create", createdById: "bob" } } }] }),
    journey("rel_tpl_default_secure_conversation", { key: "DEFAULT_SECURE_CONVERSATION", generations: [] }),
    journey("no-form", { formTemplates: [] }), journey("unsafe-form", { formTemplates: [{ id: "..", name: "bad" }] })];
  const f = fixture({ relationTemplate: ts });
  const rows = await f.repository.resolveFavorites("alice", ts.map(t => target("RELATION_TEMPLATE", t.id)));
  assert.deepEqual(rows.map((r: any) => r.objectId), ["mine", "owned"]);
});

test("classification is recomputed without rewriting the favorite", async () => {
  const link = { id: "l", ownerId: "alice", title: "Objet", rules: {} as any };
  const f = fixture({ gLink: [link] });
  await f.addFavorite(target("GLINK", "l"));
  assert.equal((await f.listFavorites()).items[0].label, "Lien");
  link.rules = { creationSource: "opportunity" };
  assert.equal((await f.listFavorites()).items[0].label, "Opportunité");
  link.rules.simpleLink = true;
  assert.equal((await f.listFavorites()).items[0].label, "Lien simple");
  assert.equal(f.saved.size, 1);
});

test("pagination is bounded, personal, advances over hidden references and exposes no hidden IDs", async () => {
  const f = fixture();
  for (let i = 0; i < 21; i++) f.saved.set(`a${i}`, { userId: "alice", ...target("PORTFOLIO", `hidden-${i}`) });
  f.saved.set("foreign", { userId: "bob", ...target() });
  assert.deepEqual(await f.listFavorites("0"), { items: [], hasMore: true, page: 0 });
  assert.deepEqual(await f.listFavorites("1"), { items: [], hasMore: false, page: 1 });
  const query = f.calls.findLast((c: any) => c.model === "list").args;
  assert.equal(query.take, 21); assert.equal(query.skip, 20); assert.equal(query.where.userId, "alice");
  assert.deepEqual(query.orderBy, [{ createdAt: "desc" }, { objectKind: "asc" }, { objectId: "asc" }]);
  for (const value of ["-1", "1001", ["1"], "garbage"]) assert.equal(targets.favoritePage(value), 0);
});

test("all public primitives require the session before touching data", async () => {
  const f = fixture(); f.as("");
  for (const action of [f.addFavorite, f.removeFavorite, f.getFavoriteState, f.listFavorites]) await assert.rejects(action(target()), /LOGIN/);
  assert.equal(f.calls.length, 0);
});

test("favorites page uses the shared primitive, shows empty state and typed contextual rows", async () => {
  let result: any = { items: [], page: 0, hasMore: false };
  const page = loadTestModule("app/(connected)/favoris/page.tsx", {
    "react/jsx-runtime": jsx, "next/link": ({ children, prefetch: _, ...props }: any) => jsx.jsx("a", { ...props, children }),
    "@/components/ObjectActionRow": objectActionRow,
    "@/lib/personal-favorites-actions": { listFavorites: async () => result },
  });
  assert.match(renderToStaticMarkup(await page.default({ searchParams: {} })), /Aucun favori accessible/);
  result = { items: [{ ...target(), title: "Projet <test>", label: "Portfolio", href: "/gouvernance/portfolios/p" }], page: 1, hasMore: true };
  const html = renderToStaticMarkup(await page.default({ searchParams: { page: "1" } }));
  assert.match(html, /Projet &lt;test&gt;/); assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /href="\/favoris\?page=2"/); assert.match(html, /href="\/favoris\?page=0"/);
  assert.match(renderShellFixture(), /href="\/favoris"/);
  assert.equal(spatial.isConnectedPathname("/favoris"), true);
});
