import { objectActionRow, organizationPanel } from "./helpers/object-action-row.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as spatial from "../lib/spatial-navigation.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { portfolioRuntimeContext } from "../lib/boussole/portfolio-context.ts";
import { getBoussoleJourneyVersion } from "../lib/boussole/registry.ts";

const row = (id: string, ownerId = "owner", portfolioId: string | null = "p") => ({ id, name: `Workspace ${id}`, ownerId, portfolioId, status: "ACTIVE", _count: { relationTemplates: 1, links: 2, relationCases: 3, communicationSessions: 4 } });
const portfolio = { id: "p", ownerId: "owner", name: "Portfolio Europe", slug: "europe", kind: "PROJECT", description: "Projets en Europe", status: "ACTIVE", createdAt: new Date("2026-01-01"), workspaces: [row("one"), row("two")] };
const base = { react: React, "react/jsx-runtime": jsx, "@/components/ObjectActionRow": objectActionRow, "@/components/OrganizationPanel": organizationPanel, "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }), "@/lib/spatial-navigation": spatial };
const createMenu = loadTestModule("components/SpacesCreateActions.tsx", base);
const shared = loadTestModule("components/WorkspaceRow.tsx", { ...base, "@/lib/governance-portfolio-actions": { attachWorkspaceToPortfolioAction: "/attach" } });
const view = loadTestModule("components/PortfolioExplorerView.tsx", { ...base, "@/components/WorkspaceRow": shared, "@/components/SpacesCreateActions": createMenu,
  "@/components/SpatialNavigationContext": { PageNavigationContext: () => null } });
const organize = loadTestModule("components/PortfolioOrganize.tsx", { ...base,
  "@/lib/governance-portfolio-actions": { attachWorkspaceToPortfolioAction: "/attach", detachWorkspaceFromPortfolioAction: "/detach" } });
function render(p = portfolio, available = [row("available", "owner", null)]) {
  return renderToStaticMarkup(jsx.jsx(view.PortfolioExplorerView, { portfolio: p, kindLabel: "Projet", organize: jsx.jsx(organize.PortfolioOrganize, { portfolio: p, available }) }));
}

test("targeted repository checks Portfolio and child ownership with direct Mes espaces counts, no N+1", async () => {
  const calls: any[] = [];
  const rows = [...portfolio.workspaces, row("foreign", "other"), row("elsewhere", "owner", "elsewhere")];
  const { getPortfolioExplorer } = loadTestModule("lib/portfolio-explorer-repository.ts", { "@/lib/prisma": { prisma: { portfolio: { findFirst: async (q: any) => {
    calls.push(q); if (q.where.id !== "p" || q.where.ownerId !== "owner") return null;
    return { ...portfolio, workspaces: rows.filter(w => w.ownerId === q.select.workspaces.where.ownerId && w.portfolioId === q.select.workspaces.where.portfolioId) };
  } } } } });
  const data = await getPortfolioExplorer("owner", "p");
  assert.deepEqual(data.workspaces.map((w: any) => w.id), ["one", "two"]); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { id: "p", ownerId: "owner" });
  assert.deepEqual(calls[0].select.workspaces.where, { portfolioId: "p", ownerId: "owner" });
  assert.deepEqual(calls[0].select.workspaces.orderBy, [{ name: "asc" }, { id: "asc" }]);
  const spaceQueries: any[] = [];
  const spaces = loadTestModule("lib/spaces-repository.ts", { "@/lib/prisma": { prisma: { portfolio: { findMany: async () => [] }, workspace: { findMany: async (q: any) => { spaceQueries.push(q); return []; } } } } });
  await spaces.getSpacesTree("owner");
  const counts = calls[0].select.workspaces.select._count.select;
  for (const key of ["relationTemplates", "links", "relationCases"]) assert.deepEqual(counts[key], spaceQueries[0].select._count.select[key]);
  assert.equal(calls[0].select.workspaces.select.relationTemplates, undefined);
  assert.equal(await getPortfolioExplorer("other", "p"), null);
  assert.equal(await getPortfolioExplorer("owner", "missing"), null);
});

test("page authenticates first, rejects unknown/foreign Portfolio, skips attach options when archived", async () => {
  let reads = 0; let optionReads = 0;
  const load = (authenticated: boolean, result: any) => loadTestModule("app/(connected)/gouvernance/portfolios/[id]/page.tsx", {
    "react/jsx-runtime": jsx, "@/components/ObjectActionRow": objectActionRow, "@/components/OrganizationPanel": organizationPanel, "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); } },
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!authenticated) throw Error("LOGIN"); return { id: "owner" }; } },
    "@/lib/portfolio-explorer-repository": { getPortfolioExplorer: async (owner: string, id: string) => { assert.equal(owner, "owner"); assert.equal(id, "p"); reads++; return result; } },
    "@/lib/governance-portfolio-repository": { portfolioKindLabels: { PROJECT: "Projet" }, getAvailableWorkspacesForPortfolio: async (owner: string) => { assert.equal(owner, "owner"); optionReads++; return []; } },
    "@/components/PortfolioExplorerView": view, "@/components/PortfolioOrganize": organize,
  }).default({ params: { id: "p" } });
  await assert.rejects(load(false, portfolio), /LOGIN/); assert.equal(reads, 0);
  await assert.rejects(load(true, null), /NOT_FOUND/); assert.equal(optionReads, 0);
  await load(true, { ...portfolio, status: "ARCHIVED" }); assert.equal(optionReads, 0);
  await load(true, portfolio); assert.equal(optionReads, 1);
});

test("real shared rows, canonical navigation, closed Organiser and secondary information", () => {
  const html = render();
  assert.ok(html.includes("Portfolio · Actif"));
  assert.ok(html.includes("1 parcours · 2 liens · 3 dossiers"));
  assert.ok(html.includes('href="/gouvernance/workspaces/one"'));
  assert.ok(html.includes('href="/gouvernance/portfolios/p/pilotage"'));
  assert.ok(html.includes('action="/attach"') && html.includes('action="/detach"'));
  assert.equal((html.match(/<details/g) ?? []).length, 3); assert.doesNotMatch(html, /<details[^>]*\bopen=/);
  const info = html.indexOf('data-portfolio-information');
  assert.ok(html.indexOf("Slug") > info && html.indexOf("communications</dd>") > info);
  assert.doesNotMatch(html, /Portfolio produit|Retour a la gouvernance|V1|role="tree"|<table/);
});

test("empty Portfolio invents no child; archived Portfolio retains detach and hides forbidden attachment", () => {
  const empty = render({ ...portfolio, workspaces: [] });
  assert.ok(empty.includes('data-boussole-id="portfolio-no-workspaces"'));
  assert.ok(!empty.includes('data-boussole-id="portfolio-first-workspace"'));
  const archived = render({ ...portfolio, status: "ARCHIVED" });
  assert.ok(archived.includes("Archivé") && archived.includes('action="/detach"'));
  assert.ok(!archived.includes('action="/attach"'));
  assert.ok(!archived.includes("+ Nouveau") && !archived.includes("?portfolioId="));
});

test("Portfolio hierarchy preserves Mes espaces, Piloter and logical parent", () => {
  assert.deepEqual(spatial.portfolioBreadcrumb({ ...portfolio, id: "portfolio-private-id" }, true).map(x => x.label), ["Accueil", "Mes espaces", "Portfolio Europe", "Piloter"]);
  assert.equal(spatial.logicalParent(spatial.portfolioBreadcrumb(portfolio))?.href, "/gouvernance");
  assert.equal(spatial.logicalParent(spatial.portfolioBreadcrumb(portfolio, true))?.href, "/gouvernance/portfolios/p");
});

test("Boussole separates collection/detail/pilotage and derives EMPTY/POPULATED/FOCUSED from real targets", () => {
  const routes = ["/gouvernance/portfolios", "/gouvernance/portfolios/p", "/gouvernance/portfolios/p/pilotage"];
  assert.deepEqual(routes.map(p => getCompassContext(p)?.id), ["portfolio", "portfolio-detail", "portfolio-pilotage"]);
  assert.equal(getCompassContext("/gouvernance/portfolios/nouveau"), null);
  assert.equal(portfolioRuntimeContext("portfolio", routes[0], [])?.pageState, "EMPTY");
  assert.equal(portfolioRuntimeContext("portfolio", routes[0], ["first-portfolio-card"])?.pageState, "POPULATED");
  for (const [id, route, target] of [["portfolio-detail", routes[1], "portfolio-detail-overview"], ["portfolio-pilotage", routes[2], "portfolio-pilotage-overview"]]) {
    assert.equal(portfolioRuntimeContext(id, route, [])?.pageState, "EMPTY");
    const context = portfolioRuntimeContext(id, route, [target]);
    assert.equal(context?.pageState, "FOCUSED"); assert.equal(context?.focusedObjectType, "PORTFOLIO");
    assert.ok(getCompassContext(route)?.steps.every(step => !step.targetId?.startsWith("first-portfolio-card")));
  }
  assert.equal(getBoussoleJourneyVersion("portfolio-counters"), 2);
  for (const id of ["portfolio-landmarks", "portfolio-card", "explore-portfolio", "understand-portfolio-pilotage"]) assert.equal(getBoussoleJourneyVersion(id), 1);
  const source = readFileSync("lib/boussole-portfolio-detail.ts", "utf8");
  assert.doesNotMatch(source, /fetch\(|\.click\(|Action\(/);
  const html = render();
  for (const step of getCompassContext(routes[1])!.steps.filter(step => !step.optional)) assert.ok(html.includes(`data-boussole-id="${step.targetId}"`));
});

function actions(workspace: any = { id: "w", portfolioId: "previous" }, target: any = { id: "p" }, authenticated = true) {
  const queries: any[] = [], writes: any[] = [], paths: string[] = [];
  const module = loadTestModule("lib/governance-portfolio-actions.ts", {
    "next/cache": { revalidatePath: (p: string) => paths.push(p) }, "next/navigation": { redirect: () => { throw Error("Unexpected redirect"); } },
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!authenticated) throw Error("LOGIN"); return { id: "owner" }; } },
    "@/lib/prisma": { prisma: { workspace: { findFirst: async (q: any) => { queries.push(q); return workspace; }, update: async (q: any) => { writes.push(q); } }, portfolio: { findFirst: async (q: any) => { queries.push(q); return target; } } } },
  });
  return { ...module, queries, writes, paths };
}
const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };

test("unchanged attach action checks owners and active target, changes only portfolioId and revalidates", async () => {
  const a = actions(); await a.attachWorkspaceToPortfolioAction(form({ workspaceId: "w", portfolioId: "p" }));
  assert.deepEqual(a.queries.map((q: any) => q.where), [{ id: "w", ownerId: "owner" }, { id: "p", ownerId: "owner", status: "ACTIVE" }]);
  assert.deepEqual(a.writes, [{ where: { id: "w" }, data: { portfolioId: "p" } }]);
  assert.deepEqual(a.paths, ["/gouvernance", "/gouvernance/portfolios/p"]);
  // Existing behavior: membership and Workspace status are not extra server restrictions.
  assert.equal(a.queries[0].where.portfolioId, undefined); assert.equal(a.queries[0].where.status, undefined);
});
test("attach rejects unauthenticated, missing input, foreign Workspace or unavailable target without writes", async () => {
  for (const a of [actions(null), actions(undefined, null), actions(undefined, undefined, false)]) {
    await assert.rejects(a.attachWorkspaceToPortfolioAction(form({ workspaceId: "w", portfolioId: "p" })));
    assert.equal(a.writes.length, 0);
  }
  const a = actions(); await assert.rejects(a.attachWorkspaceToPortfolioAction(form({}))); assert.equal(a.queries.length, 0);
});
test("unchanged detach action checks Workspace owner, clears membership and revalidates former Portfolio", async () => {
  const a = actions(); await a.detachWorkspaceFromPortfolioAction(form({ workspaceId: "w" }));
  assert.deepEqual(a.queries[0].where, { id: "w", ownerId: "owner" });
  assert.deepEqual(a.writes, [{ where: { id: "w" }, data: { portfolioId: null } }]);
  assert.deepEqual(a.paths, ["/gouvernance", "/gouvernance/portfolios/previous"]);
  for (const invalid of [actions(null), actions(undefined, undefined, false)]) {
    await assert.rejects(invalid.detachWorkspaceFromPortfolioAction(form({ workspaceId: "w" })));
    assert.equal(invalid.writes.length, 0);
  }
  const missing = actions(); await assert.rejects(missing.detachWorkspaceFromPortfolioAction(form({}))); assert.equal(missing.writes.length, 0);
});
