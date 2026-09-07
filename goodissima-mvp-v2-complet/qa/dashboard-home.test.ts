import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { dashboardRuntimeContext, dashboardSequences } from "../lib/boussole-dashboard.ts";
import { getBoussoleJourneyVersion } from "../lib/boussole/registry.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const view = loadTestModule("components/DashboardHome.tsx", { "react/jsx-runtime": jsx, "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }) });
const event = { id: "link-1", label: "Lien créé", context: "Contexte <test>", date: new Date("2026-09-01T12:00:00Z"), href: "/links/1" };
const render = (activity: any[] = []) => renderToStaticMarkup(jsx.jsx(view.DashboardHome, { activity }));

test("same three canonical doors without removed business blocks, in both states", () => {
  for (const html of [render(), render([event])]) {
    assert.match(html, />Accueil<\/h1>/);
    for (const href of ["/boussole/decouverte", "/annuaire", "/gouvernance"]) assert.ok(html.includes(`href="${href}"`));
    for (const title of ["Boussole", "Annuaire", "Mes espaces"]) assert.ok(html.includes(title));
    assert.doesNotMatch(html, /Mes opportunités et relations|dashboard-indicators|dashboard-links-list|Champagne|Vue exécutive|Créer un|Nouveau|live|Publié|vous n’avez|overflow-y|placeholder|aria-pressed/);
    assert.match(html, /focus-visible:outline/);
  }
  assert.doesNotMatch(render(), /Activité récente|<time/);
  const populated = render([event]);
  assert.match(populated, /datetime="2026-09-01T12:00:00.000Z"/i);
  assert.match(populated, /Contexte &lt;test&gt;/);
  assert.match(populated, /href="\/links\/1"/);
});

test("repository applies A/B ownership, three bounded projections and global chronological limit", async () => {
  const calls: any[] = [];
  const rows = Array.from({ length: 12 }, (_, i) => ({ id: String(i), ownerId: i % 2 ? "B" : "A", createdAt: new Date(Date.UTC(2026, 8, i + 1)), title: `Lien ${i}`, gLink: { title: `Contexte ${i}` }, relationCase: { id: `case-${i}`, ownerId: i % 2 ? "B" : "A", gLink: { title: `Document ${i}` } } }));
  const findMany = (model: string) => async (q: any) => {
    calls.push({ model, q });
    assert.equal(q.take, 5);
    assert.deepEqual(q.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
    assert.ok(q.select); assert.equal(q.include, undefined);
    const owner = model === "document" ? q.where.relationCase.ownerId : q.where.ownerId;
    return rows.filter(r => r.ownerId === owner).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0,q.take);
  };
  const repo = loadTestModule("lib/dashboard-activity-repository.ts", { "@/lib/prisma": { prisma: { gLink: { findMany: findMany("gLink") }, relationCase: { findMany: findMany("relationCase") }, document: { findMany: findMany("document") } } } });
  for (const owner of ["A", "B", "empty"]) {
    calls.length = 0;
    const result = await repo.getDashboardActivity(owner);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map(c => c.q.where), [{ ownerId: owner }, { ownerId: owner }, { relationCase: { ownerId: owner } }]);
    assert.equal(result.length, owner === "empty" ? 0 : 5);
    for (const [i,item] of result.entries()) {
      const id = Number(item.id.split("-").at(-1));
      assert.equal(id % 2, owner === "A" ? 0 : 1);
      assert.ok(i === 0 || result[i-1].date >= item.date);
      assert.ok(item.href === (item.label === "Lien créé" ? `/links/${id}` : item.label === "Dossier ouvert" ? `/cases/${id}` : `/cases/case-${id}`));
      assert.doesNotMatch(JSON.stringify(item), /token|email|\/secure\/|Publié|live/);
    }
    if (result.length) assert.deepEqual(new Set(result.map((e: any) => e.label)), new Set(["Lien créé", "Dossier ouvert", "Document déposé"]));
  }
});

test("page authenticates before the activity repository and calls no historical loaders", async () => {
  let reads = 0;
  const load = (authenticated: boolean) => loadTestModule("app/(connected)/dashboard/page.tsx", {
    "react/jsx-runtime": jsx, "next/cache": { unstable_noStore: () => {} },
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!authenticated) throw Error("LOGIN"); return { id: "A" }; } },
    "@/lib/dashboard-activity-repository": { getDashboardActivity: async (owner: string) => { assert.equal(owner,"A"); reads++; return []; } },
    "@/components/DashboardHome": view,
  }).default();
  await assert.rejects(load(false), /LOGIN/); assert.equal(reads, 0);
  await load(true); assert.equal(reads, 1);
  assert.doesNotMatch(source("app/(connected)/dashboard/page.tsx"), /prisma|Matching|Archived|AIEvent|DashboardLinkFilters/);
});

test("dashboard guides use real targets, correct states and independently revised progress", () => {
  for (const activity of [[], [event]]) {
    const html = render(activity);
    const targets = [...html.matchAll(/data-boussole-id="([^"]+)"/g)].map(m => m[1]);
    const context = dashboardRuntimeContext("dashboard", targets);
    assert.equal(context.pageState, activity.length ? "POPULATED" : "EMPTY");
    for (const journey of dashboardSequences.filter(s => s.applicableStates?.includes(context.pageState!))) {
      assert.equal(getBoussoleJourneyVersion(journey.id), 2);
      for (const step of journey.steps) assert.ok(step.targetId === "dashboard-menu" || targets.includes(step.targetId!));
    }
  }
  assert.deepEqual(dashboardSequences.map(s => s.id), ["repères", "activité"]);
  assert.deepEqual(dashboardRuntimeContext("portfolio", []), {});
  assert.doesNotMatch(source("lib/boussole-dashboard.ts"), /dashboard-link-|dashboard-indicators|dashboard-create-actions|FOCUSED|fetch\(/);
  assert.doesNotMatch(source("lib/boussole/glossary.ts"), /dataBoussoleId: "dashboard-(?:link-|create-actions)/);
});
