import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { shellModules, renderShellFixture } from "./helpers/render-connected-shell.ts";
import * as targets from "../lib/personal-favorite-target.ts";
import * as classification from "../lib/object-creation.ts";
import * as spatial from "../lib/spatial-navigation.ts";

const common = { "react/jsx-runtime": jsx, "next/link": ({ children, prefetch: _, ...props }: any) => jsx.jsx("a", { ...props, children }) };
const list = loadTestModule("components/FactualAttentionList.tsx", common);
const home = loadTestModule("components/DashboardHome.tsx", { ...common, "@/components/FactualAttentionList": list });
test("compact commands have explicit accessible names, titles and keyboard focus", () => {
  const html = renderShellFixture();
  for (const [href, label] of [["/favoris", "Favoris"], ["/recherche", "Recherche Goodissima"]]) {
    const anchor = html.match(new RegExp('<a[^>]*href="' + href + '"[^>]*>'))![0];
    assert.ok(anchor.includes('aria-label="' + label + '"'));
    assert.ok(anchor.includes('title="' + label + '"'));
    assert.match(anchor, /focus-visible:outline/);
  }
  assert.match(html, /Boussole/); assert.doesNotMatch(html, /Bien démarrer/);
});
test("simplified user menu preserves granular AI permission and existing Administration access", () => {
  const { PlatformNavigation } = shellModules("/dashboard");
  for (const aiValueAllowed of [false, true]) {
    const html = renderToStaticMarkup(jsx.jsx(PlatformNavigation, { aiValueAllowed }));
    assert.match(html, /Mon profil/);
    assert.match(html, /href="\/identity"/);
    assert.match(html, /href="\/administration"/);
    assert.match(html, />FR</); assert.match(html, />EN</);
    assert.match(html, /Se déconnecter/);
    assert.equal(html.includes('href="/ia-valeur"'), aiValueAllowed);
    for (const href of ["/links/simple", "/gouvernance/pilotage", "/gouvernance/portfolios", "/gouvernance/nouveau", "/trust/connectors", "/opportunities", "/parcours", "/relations"])
      assert.ok(!html.includes('href="' + href + '"'));
    assert.doesNotMatch(html, /Autres accès/);
  }
});
test("home uses the existing bounded resolver with session scope before showing five accessible favorites", async () => {
  let userId = "alice";
  const calls: any[] = [];
  const access = loadTestModule("lib/relation-template-access.ts", { "@/lib/prisma": { prisma: {} } });
  const repository = loadTestModule("lib/personal-favorites-repository.ts", {
    "@/lib/prisma": { prisma: {
      personalFavorite: { findMany: async (q: any) => {
        calls.push(["references", q]); assert.equal(q.take, 21); assert.equal(q.skip, 0);
        assert.equal(q.where.userId, userId);
        return Array.from({ length: 8 }, (_, i) => ({ objectKind: "PORTFOLIO", objectId: "id-" + i }));
      } },
      portfolio: { findMany: async (q: any) => {
        calls.push(["resolve", q]); assert.equal(q.where.ownerId, userId); assert.equal(q.take, 8);
        // Foreign/deleted references are hidden by the unchanged resolver's scoped query.
        return userId === "alice" ? Array.from({ length: 6 }, (_, i) => ({ id: "id-" + i, name: "Portfolio <" + i + ">" })) : [];
      } },
    } },
    "@/lib/personal-favorite-target": targets, "@/lib/object-creation": classification,
    "@/lib/spatial-navigation": spatial, "@/lib/relation-template-access": access,
  });
  const page = loadTestModule("app/(connected)/dashboard/page.tsx", {
    ...common, "next/cache": { unstable_noStore() {} },
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!userId) throw Error("LOGIN"); return { id: userId }; } },
    "@/lib/personal-favorites-repository": repository,
    "@/lib/factual-attention": { getFactualAttention: async (id: string, page: number, size: number) => {
      assert.equal(id, userId); assert.equal(page, 0); assert.equal(size, 3);
      return { items: [], hasMore: false };
    } },
    "@/lib/dashboard-activity-repository": { getDashboardActivity: async () => [] },
    "@/components/DashboardHome": home,
  });
  const element = await page.default();
  assert.equal(element.props.favorites.length, 5);
  assert.equal(calls.length, 2);
  const html = renderToStaticMarkup(element);
  assert.equal((html.match(/href="\/gouvernance\/portfolios\//g) ?? []).length, 5);
  assert.match(html, /Portfolio &lt;0&gt;/);
  assert.doesNotMatch(html, /token|invitation|Portfolio &lt;5&gt;/);
  userId = "bob";
  const empty = renderToStaticMarkup(await page.default());
  assert.doesNotMatch(empty, /Portfolio &lt;/);
  assert.match(empty, /menu •••/);
  assert.match(empty, /Rien ne nécessite actuellement votre attention/);
  userId = ""; calls.length = 0;
  await assert.rejects(page.default(), /LOGIN/); assert.equal(calls.length, 0);
});
test("home ordering, doors and links use the existing projections without artificial counts", () => {
  const html = renderToStaticMarkup(jsx.jsx(home.DashboardHome, {
    attention: { items: [], hasMore: false }, favorites: [],
    activity: [{ id: "link-1", label: "Lien créé", context: "Objet", href: "/links/1", date: new Date() }],
  }));
  const positions = ["Que souhaitez-vous faire ?", "À votre attention", "dashboard-favorites-title", "Activité récente"].map(s => html.indexOf(s));
  assert.ok(positions.every((p, i) => p >= 0 && (!i || p > positions[i - 1])));
  assert.match(html, /Bien démarrer/); assert.match(html, /href="\/boussole\/decouverte"/);
  assert.match(html, /href="\/favoris"/); assert.doesNotMatch(html, /Voir toutes/);
});
