import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { renderShellFixture } from "./helpers/render-connected-shell.ts";
import * as classification from "../lib/object-creation.ts";
import * as spatial from "../lib/spatial-navigation.ts";

const access = loadTestModule("lib/relation-template-access.ts", { "@/lib/prisma": { prisma: {} } });
function fixture(rows: Record<string, any[]> = {}) {
  const calls: Array<{ model: string; args: any }> = [];
  const prisma = Object.fromEntries(["portfolio", "workspace", "gLink", "relationTemplate", "relationCase"].map(model => [model, {
    findMany: async (args: any) => { calls.push({ model, args }); return rows[model] ?? []; },
  }]));
  const search = loadTestModule("lib/goodissima-search.ts", {
    "@/lib/prisma": { prisma }, "@/lib/object-creation": classification,
    "@/lib/spatial-navigation": spatial, "@/lib/relation-template-access": access,
  });
  return { ...search, calls };
}
const template = (id: string, extra = {}) => ({ id, key: id, status: "ACTIVE", workspaceId: null, workspace: null,
  name: "Projet", generations: [{ createdById: "owner" }], versions: [], formTemplates: [{ id: `form-${id}`, name: "Projet" }], ...extra });

test("empty, short, oversized and repeated query parameters perform no object queries", async () => {
  const f = fixture();
  for (const q of [undefined, "", " ", "a", "x".repeat(81), ["Projet", "autre"], {}, null]) {
    assert.deepEqual(await f.searchGoodissima("owner", q), { items: [], limited: false });
  }
  await f.searchGoodissima("", "Projet");
  assert.equal(f.calls.length, 0);
});

test("all five SQL queries are bounded, ordered, scoped and search before retrieval", async () => {
  const f = fixture();
  await f.searchGoodissima("owner", "  Projet  ");
  assert.equal(f.calls.length, 5);
  for (const { model, args } of f.calls) {
    assert.equal(args.take, 11);
    assert.deepEqual(args.orderBy, [{ createdAt: "desc" }, { id: "asc" }]);
    assert.equal(args.include, undefined);
    if (model !== "relationTemplate") {
      assert.equal(args.where.ownerId, "owner");
      assert.deepEqual(args.where[model === "gLink" ? "title" : model === "relationCase" ? "candidateName" : "name"], { contains: "Projet", mode: "insensitive" });
    } else {
      assert.deepEqual(args.where.AND[0], { OR: [{ workspace: { ownerId: "owner" } }, access.getTemplateCreationProofWhere("owner")] });
      assert.deepEqual(args.where.AND[1], { OR: [{ name: { contains: "Projet", mode: "insensitive" } }, { formTemplates: { some: { name: { contains: "Projet", mode: "insensitive" } } } }] });
      assert.deepEqual(args.where.formTemplates, { some: {} });
      assert.equal(args.select.formTemplates.take, 1);
      assert.deepEqual(args.select.generations, access.templateAccessSelect.generations);
      assert.deepEqual(args.select.versions, access.templateAccessSelect.versions);
    }
  }
  assert.deepEqual(f.calls.find((c: any) => c.model === "gLink").args.where.OR, [
    { rules: { path: ["simpleLink"], equals: true } }, { rules: { path: ["creationSource"], equals: "opportunity" } },
  ]);
  assert.deepEqual(f.calls.find((c: any) => c.model === "relationCase").args.select, { id: true, candidateName: true });
});

test("READ reuses Workspace precedence and rejects foreign, contradictory and system-only proofs", async () => {
  const f = fixture({ relationTemplate: [
    template("creator"), template("workspace", { workspaceId: "w", workspace: { ownerId: "owner" }, generations: [] }),
    template("foreign-workspace", { workspaceId: "foreign", workspace: { ownerId: "other" } }),
    template("foreign", { generations: [{ createdById: "other" }] }),
    template("conflict", { generations: [{ createdById: "owner" }, { createdById: "other" }] }),
    template("snapshot-conflict", { versions: [{ snapshot: { metadata: { source: "governance-v1-minimal-create", createdById: "other" } } }] }),
    template("rel_tpl_default_secure_conversation", { key: "DEFAULT_SECURE_CONVERSATION", generations: [] }),
  ] });
  const result = await f.searchGoodissima("owner", "Projet");
  assert.deepEqual(result.items.map((r: any) => r.href), ["/gouvernance/parcours/form-creator/pilotage", "/gouvernance/parcours/form-workspace/pilotage"]);
  assert.equal(f.calls.length, 5);
});

test("six object types use existing classification and encoded internal destinations only", async () => {
  const f = fixture({ portfolio: [{ id: "p/?token=x", name: "Projet" }], workspace: [{ id: "w", name: "Projet" }],
    gLink: [{ id: "simple", title: "Projet", rules: { simpleLink: true, creationSource: "opportunity" } },
      { id: "opp", title: "https://site/secure/token", rules: { creationSource: "opportunity" } }],
    relationTemplate: [template("t")], relationCase: [{ id: "c", candidateName: "Alice" }] });
  const result = await f.searchGoodissima("owner", "Projet");
  assert.deepEqual(result.items.map((r: any) => r.type), ["Portfolio", "Workspace", "Lien simple", "Opportunité", "Parcours gouverné", "Dossier"]);
  assert.equal(result.items[0].href, "/gouvernance/portfolios/p%2F%3Ftoken%3Dx");
  assert.equal(result.items[3].title, "Opportunité");
  for (const item of result.items) {
    assert.deepEqual(Object.keys(item).sort(), ["href", "title", "type"]);
    assert.match(item.href, /^\/(?:gouvernance\/(?:portfolios|workspaces|parcours)|links|cases)\//);
    assert.doesNotMatch(item.href, /[?#]|\/secure\/|\/invitation\/|^https?:/);
  }
});

test("window sentinel is not rendered and SQL wildcard input is literal", async () => {
  const f = fixture({ portfolio: Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, name: "Projet" })) });
  const result = await f.searchGoodissima("owner", "%_\\");
  assert.equal(result.items.length, 10);
  assert.equal(result.limited, true);
  assert.equal(f.calls[0].args.where.name.contains, "\\%\\_\\\\");
});

function page(auth: () => Promise<any>, search: (...args: any[]) => Promise<any>) {
  return loadTestModule("app/(connected)/recherche/page.tsx", {
    "react/jsx-runtime": jsx, "next/link": ({ children, prefetch: _, ...props }: any) => jsx.jsx("a", { ...props, children }),
    "next/cache": { unstable_noStore() {} }, "@/lib/auth": { getCurrentPrismaUser: auth },
    "@/lib/goodissima-search": { searchGoodissima: search, searchTerm: fixture().searchTerm },
  }).default;
}
test("page uses authenticated identity, escapes titles, and submits only on demand", async () => {
  let received: any[] = [];
  const render = page(async () => ({ id: "session-owner" }), async (...args) => { received = args; return { items: [{ type: "Portfolio", title: "<script>alert(1)</script>", href: "/gouvernance/portfolios/p" }], limited: false }; });
  const html = renderToStaticMarkup(await render({ searchParams: { q: "Projet", ownerId: "foreign" } }));
  assert.deepEqual(received, ["session-owner", "Projet"]);
  assert.match(html, /method="get" role="search"/);
  assert.match(html, /minLength="2" maxLength="80"/);
  assert.match(html, /for="goodissima-query"/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Annuaire Global/);
  assert.doesNotMatch(html, /<script|onChange|onInput/);
});
test("unauthenticated page never queries; initial and no-result states are explicit", async () => {
  const redirect = new Error("redirect login");
  await assert.rejects(page(async () => { throw redirect; }, async () => { throw Error("unexpected query"); })({ searchParams: {} }), e => e === redirect);
  const render = page(async () => ({ id: "owner" }), async () => ({ items: [], limited: false }));
  assert.match(renderToStaticMarkup(await render({ searchParams: {} })), /Saisissez un nom ou un titre/);
  assert.match(renderToStaticMarkup(await render({ searchParams: { q: "Projet" } })), /Aucun objet accessible trouvé/);
});
test("search is reachable from the existing shell and has a connected breadcrumb", () => {
  assert.match(renderShellFixture(), /href="\/recherche"/);
  assert.equal(spatial.isConnectedPathname("/recherche"), true);
  assert.deepEqual(spatial.pageBreadcrumb("/recherche"), [{ label: "Accueil", href: "/dashboard" }, { label: "Recherche Goodissima" }]);
});
