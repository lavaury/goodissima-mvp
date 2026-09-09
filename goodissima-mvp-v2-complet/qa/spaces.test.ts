import { objectActionRow } from "./helpers/object-action-row.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as spatial from "../lib/spatial-navigation.ts";
import { getBoussoleJourneyVersion } from "../lib/boussole/registry.ts";
import { getCompassContext } from "../lib/boussole-context.ts";

const portfolios = [{ id: "p1", ownerId: "a", name: "Europe", status: "ACTIVE" }, { id: "p2", ownerId: "a", name: "Clients", status: "ARCHIVED" }, { id: "foreign", ownerId: "b", name: "Secret", status: "ACTIVE" }];
const workspace = (id: string, portfolioId: string | null, ownerId = "a") => ({ id, portfolioId, ownerId, name: id, status: "ACTIVE", _count: { relationTemplates: 2, links: 3, relationCases: 4 } });
const workspaces = [workspace("w1", "p1"), workspace("w2", "p1"), workspace("w3", "p2"), workspace("root", null), workspace("hidden", "foreign"), workspace("missing", "unknown"), workspace("foreign-child", "p1", "b")];
function repository(rows = workspaces) {
  const calls: any[] = [];
  const { getSpacesTree } = loadTestModule("lib/spaces-repository.ts", { "@/lib/prisma": { prisma: {
    portfolio: { findMany: async (q: any) => { calls.push(q); return portfolios.filter(p => p.ownerId === q.where.ownerId); } },
    workspace: { findMany: async (q: any) => { calls.push(q); return rows.filter(w => w.ownerId === q.where.ownerId); } },
  } } });
  return { read: getSpacesTree, calls };
}
const common = { react: React, "react/jsx-runtime": jsx, "@/components/ObjectActionRow": objectActionRow, "react-dom": { flushSync: (fn: () => void) => fn() }, "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }), "@/lib/spatial-navigation": spatial };
const row = loadTestModule("components/WorkspaceRow.tsx", common);
const { SpacesTreeView } = loadTestModule("components/SpacesTreeView.tsx", { ...common, "@/components/WorkspaceRow": row });
test("real owner-scoped repository groups by foreign key exactly once; inaccessible parents are never roots", async () => {
  const s = repository(); const data = await s.read("a");
  assert.deepEqual(data.portfolios.map((p: any) => [p.id, p.workspaces.map((w: any) => w.id)]), [["p1", ["w1", "w2"]], ["p2", ["w3"]]]);
  assert.deepEqual(data.roots.map((w: any) => w.id), ["root"]);
  assert.equal(data.unavailableParentCount, 2);
  assert.equal(s.calls.length, 2);
  assert.deepEqual(s.calls[1].select._count.select.links, { where: { ownerId: "a" } });
  assert.deepEqual(s.calls[1].select._count.select.relationCases, { where: { ownerId: "a" } });
  assert.equal(s.calls[1].select.relationTemplates, undefined);
});
test("real tree renders distinct native disclosures, canonical links, counts and archives", async () => {
  const data = await repository().read("a"); const html = renderToStaticMarkup(jsx.jsx(SpacesTreeView, { data }));
  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 2);
  assert.ok(html.includes('aria-controls=') && html.includes('type="button"'));
  for (const id of ["w1", "w2", "w3", "root"]) assert.equal((html.match(new RegExp(`href="/gouvernance/workspaces/${id}"`, "g")) ?? []).length, 2);
  assert.ok(html.includes('/gouvernance/portfolios/p1') && html.includes("Archivé"));
  assert.ok(html.includes("2 parcours · 3 liens · 4 dossiers"));
  assert.ok(!html.includes("Secret") && !html.includes("foreign-child") && !html.includes("/parcours/"));
  assert.ok(html.includes("Portfolio n’est pas accessible"));
  assert.ok(!html.includes('role="tree"'));
});
test("more than five Portfolios starts with only first expanded; empty states are truthful", () => {
  const data = { portfolios: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, status: "ACTIVE", workspaces: [] })), roots: [], unavailableParentCount: 0 };
  const html = renderToStaticMarkup(jsx.jsx(SpacesTreeView, { data }));
  assert.equal((html.match(/<button\b(?=[^>]*aria-label="Développer le Portfolio : )(?=[^>]*aria-expanded="false")[^>]*>/g) ?? []).length, 5);
  assert.ok(html.includes('data-boussole-id="governance-empty-state"'));
  const unavailable = renderToStaticMarkup(jsx.jsx(SpacesTreeView, { data: { ...data, portfolios: [], unavailableParentCount: 1 } }));
  assert.ok(!unavailable.includes('data-boussole-id="governance-empty-state"'));
});
test("root creation exposes the five global destinations", () => {
  const { SpacesCreateActions } = loadTestModule("components/SpacesCreateActions.tsx", common);
  const html = renderToStaticMarkup(jsx.jsx(SpacesCreateActions, {}));
  assert.equal((html.match(/<a /g) ?? []).length, 5);
  for (const route of ["/gouvernance/workspaces/nouveau", "/gouvernance/portfolios/nouveau"]) assert.ok(html.includes(route));
  const nav = readFileSync("components/PlatformNavigation.tsx", "utf8");
  for (const route of ["/annuaire", "/gouvernance/nouveau", "/gouvernance/pilotage", "/links/simple"]) assert.ok(nav.includes(route));
});
test("page authenticates before loading, removes old cards and preserves existing attachments", async () => {
  let reads = 0;
  const page = (authenticated: boolean) => loadTestModule("app/(connected)/gouvernance/page.tsx", { "react/jsx-runtime": jsx, "@/components/ObjectActionRow": objectActionRow,
    "next/cache": { unstable_noStore() {} }, "@/lib/auth": { getCurrentPrismaUser: async () => { if (!authenticated) throw Error("LOGIN"); return { id: "a" }; } },
    "@/lib/spaces-repository": { getSpacesTree: async (id: string) => { assert.equal(id, "a"); reads++; return { portfolios: [], roots: [], unavailableParentCount: 0 }; } },
    "@/components/SpacesTreeView": { SpacesTreeView }, "@/components/SpacesCreateActions": { SpacesCreateActions: () => null },
    "@/components/SpacesExistingAttachments": { SpacesExistingAttachments: () => null },
  });
  await assert.rejects(page(false).default({}), /LOGIN/); assert.equal(reads, 0);
  const html = renderToStaticMarkup(await page(true).default({}));
  assert.ok(html.includes('>Mes espaces</h1>'));
  for (const old of ["Accueil de la Gouvernance", ">Gouvernance</h1>", "Annuaire Goodissima V1", "Salle de pilotage"]) assert.ok(!html.includes(old));
  const legacy = readFileSync("components/SpacesExistingAttachments.tsx", "utf8");
  for (const action of ["attachGovernedJourneyToWorkspaceAction", "attachRelationCaseToWorkspaceAction", "attachGLinkToWorkspaceAction"]) assert.ok(legacy.includes(`action={${action}}`));
});
test("Boussole versions change only for revised journeys; Workspace focus remains outside collection guide", () => {
  for (const id of ["understand-governance", "governance-summary", "understand-workspaces"]) assert.equal(getBoussoleJourneyVersion(id), 2);
  assert.equal(getBoussoleJourneyVersion("organize-unassigned"), 2);
  assert.equal(getCompassContext("/gouvernance/workspaces/w1"), null);
  assert.equal(getCompassContext("/gouvernance")?.pageName, "Comprendre Mes espaces");
});
test("1000 Workspaces retain a constant two-query tree contract", async () => {
  const s = repository(Array.from({ length: 1000 }, (_, i) => workspace(`w${i}`, i % 2 ? "p1" : null)));
  const data = await s.read("a"); assert.equal(s.calls.length, 2);
  assert.equal(data.roots.length + data.portfolios[0].workspaces.length, 1000);
});
