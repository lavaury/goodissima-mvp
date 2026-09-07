import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { workspaceBreadcrumb, logicalParent } from "../lib/spatial-navigation.ts";
import { getCompassContext } from "../lib/boussole-context.ts";

const base = { id: "w-a", ownerId: "a", name: "Contentieux", description: "Contexte réel", category: "PROJECT", kind: "GOVERNANCE", status: "ACTIVE", portfolio: { id: "p-a", ownerId: "a", name: "Europe" } };
const rows = {
  relationTemplates: [{ id: "journey", workspaceId: "w-a", name: "Parcours", status: "DRAFT", formTemplates: [{ id: "form", name: "Parcours ouvrable" }] }, { id: "no-form", workspaceId: "w-a", name: "Sans formulaire", status: "DRAFT", formTemplates: [] }],
  links: [{ id: "link", workspaceId: "w-a", ownerId: "a", title: "Lien direct", status: "ACTIVE" }],
  relationCases: [{ id: "case", workspaceId: "w-a", ownerId: "a", candidateName: "Candidat", status: "NEW", gLink: { title: "Lien direct" } },
    { id: "indirect", workspaceId: null, ownerId: "a", candidateName: "Indirect", gLink: { workspaceId: "w-a", title: "Lien direct" } }],
};
function repository() {
  let query: any;
  const module = loadTestModule("lib/workspace-detail-repository.ts", { "@/lib/prisma": { prisma: { workspace: { findFirst: async (input: any) => {
    query = input;
    const workspace = [base, { ...base, id: "w-b", ownerId: "b" }, { ...base, id: "archived", status: "ARCHIVED" }, { ...base, id: "empty", portfolio: null }].find(row => row.id === input.where.id && row.ownerId === input.where.ownerId);
    if (!workspace) return null;
    return { ...workspace, ...Object.fromEntries(Object.entries(rows).map(([key, values]) => {
      const where = input.select[key].where;
      assert.deepEqual(where, key === "relationTemplates" ? { workspaceId: workspace.id } : { workspaceId: workspace.id, ownerId: input.where.ownerId });
      const candidates = [...values, { ...values[0], id: "other-workspace", workspaceId: "w-other" }, { ...values[0], id: "unassigned", workspaceId: null }, ...(key === "relationTemplates" ? [] : [{ ...values[0], id: "foreign-owner", ownerId: "b" }])];
      return [key, candidates.filter(row => Object.entries(where).every(([field, value]) => (row as any)[field] === value))];
    })) };
  } } } } });
  return { read: module.getWorkspaceDetail, query: () => query };
}
test("owner and ID isolation includes same-named workspaces, unknown, empty and archived", async () => {
  const { read, query } = repository();
  assert.equal((await read("a", "w-a")).name, "Contentieux");
  assert.equal(await read("a", "w-b"), null);
  assert.equal((await read("b", "w-b")).ownerId, "b");
  assert.equal(await read("a", "unknown"), null);
  assert.equal((await read("a", "archived")).status, "ARCHIVED");
  assert.deepEqual((await read("a", "empty")).links, []);
  assert.equal(query().select.relationCases.select.candidateAccessToken, undefined);
});
test("Explorer selects only direct objects and omits unassigned, foreign and indirect cases", async () => {
  const data = await repository().read("a", "w-a");
  assert.deepEqual(data.relationTemplates.map((row: any) => row.id), ["journey", "no-form"]);
  assert.deepEqual(data.links.map((row: any) => row.id), ["link"]);
  assert.deepEqual(data.relationCases.map((row: any) => row.id), ["case"]);
});
const spatial = loadTestModule("lib/spatial-navigation.ts", {});
const { WorkspaceDetailView } = loadTestModule("components/WorkspaceDetailView.tsx", { "react/jsx-runtime": jsx,
  "@/components/WorkspaceCreateActions": { WorkspaceCreateActions: () => jsx.jsx("div", { children: "+ Nouveau" }) },
  "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }), "@/lib/spatial-navigation": spatial,
  "@/components/SpatialNavigationContext": { PageNavigationContext: () => null } });
test("real Explorer rendering uses FormTemplate IDs, no fake link or duplicate Opportunity", async () => {
  const html = renderToStaticMarkup(jsx.jsx(WorkspaceDetailView, { workspace: await repository().read("a", "w-a"), explorer: true }));
  for (const href of ["/gouvernance/parcours/form/pilotage", "/links/link", "/cases/case"]) assert.equal(html.split(`href="${href}"`).length - 1, 1);
  assert.ok(html.includes("Aucun formulaire disponible"));
  assert.ok(!html.includes("/parcours/journey/") && !html.includes("Opportunité") && !html.includes("Indirect"));
  assert.ok(html.includes('href="/gouvernance/workspaces/w-a?view=explorer" aria-current="page"'));
});
test("empty archived and default Piloter render honestly without mutation controls", async () => {
  const empty = renderToStaticMarkup(jsx.jsx(WorkspaceDetailView, { workspace: await repository().read("a", "empty"), explorer: true }));
  assert.ok(empty.includes("Aucun parcours, lien ou dossier"));
  const html = renderToStaticMarkup(jsx.jsx(WorkspaceDetailView, { workspace: await repository().read("a", "archived") }));
  assert.ok(html.includes("Archivé"));
  assert.ok(!html.includes("<form") && !html.includes("Restaurer") && !html.includes("Nouveau parcours"));
});
test("page executes authentication before scoped read and propagates notFound", async () => {
  const module = (owner: string | null) => loadTestModule("app/(connected)/gouvernance/workspaces/[id]/page.tsx", {
    "react/jsx-runtime": jsx, "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); } },
    "@/lib/auth": { getCurrentPrismaUser: async () => { if (!owner) throw Error("LOGIN"); return { id: owner }; } },
    "@/lib/workspace-detail-repository": { getWorkspaceDetail: repository().read },
    "@/components/WorkspaceDetailView": { WorkspaceDetailView },
    "@/lib/workspace-pilotage-repository": { getWorkspacePilotage: async () => ({ signals: [], attention: [], upcoming: [], recent: [] }) },
    "@/components/WorkspacePilotageView": { WorkspacePilotageView: () => null },
  });
  for (const id of ["unknown", "w-b"]) await assert.rejects(module("a").default({ params: { id } }), /NOT_FOUND/);
  await assert.rejects(module(null).default({ params: { id: "w-a" } }), /LOGIN/);
  assert.equal((await module("a").default({ params: { id: "w-a" }, searchParams: { view: "explorer" } })).props.explorer, true);
  assert.equal((await module("a").default({ params: { id: "w-a" }, searchParams: { view: "invalid" } })).props.explorer, false);
});
test("Workspace breadcrumb has real Portfolio parent or Mes espaces", () => {
  assert.deepEqual(workspaceBreadcrumb(base).map(row => row.label), ["Accueil", "Mes espaces", "Europe", "Contentieux"]);
  assert.equal(logicalParent(workspaceBreadcrumb(base))?.href, "/gouvernance/portfolios/p-a");
  assert.equal(logicalParent(workspaceBreadcrumb({ ...base, portfolio: null }))?.href, "/gouvernance");
  assert.equal(logicalParent(workspaceBreadcrumb({ ...base, portfolio: { ...base.portfolio, ownerId: "b" } }))?.href, "/gouvernance");
});
test("Workspace focused, empty and populated views do not inherit absent Governance targets", () => {
  for (const search of ["", "?view=explorer"]) assert.equal(getCompassContext("/gouvernance/workspaces/w-a", search), null);
  assert.ok(getCompassContext("/gouvernance"));
});
test("both Workspace entry repositories use canonical destination, Governance exposes a real anchor", () => {
  const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  for (const file of ["lib/governance-workspace-repository.ts", "lib/governance-portfolio-repository.ts"]) {
    assert.ok(read(file).includes('href: `/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`'));
    assert.ok(!read(file).includes("firstWorkspaceHref") && !read(file).includes("firstJourneyHref"));
  }
  assert.ok(read("components/WorkspaceRow.tsx").includes("/gouvernance/workspaces/${encodeURIComponent(workspace.id)}"));
  assert.match(read("components/PortfolioExplorerView.tsx"), /<WorkspaceRow/);
});
