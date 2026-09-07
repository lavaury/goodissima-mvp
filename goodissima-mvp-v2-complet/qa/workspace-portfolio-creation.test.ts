import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as spatial from "../lib/spatial-navigation.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { getBoussoleJourneyVersion } from "../lib/boussole/registry.ts";

const active = { id: "portfolio-owned", name: "Europe", ownerId: "owner", status: "ACTIVE" };
const portfolios = [active, { ...active, id: "portfolio-foreign", ownerId: "foreign" }, { ...active, id: "portfolio-archived", status: "ARCHIVED" }];
function setup(owner: string | null = "owner", collision = false) {
  const calls: any[] = [], writes: any[] = [], invalidated: string[] = [];
  let slugReads = 0;
  const prisma = {
    portfolio: { findFirst: async (q: any) => { calls.push({ model: "portfolio", ...q }); return portfolios.find(p => Object.entries(q.where).every(([key, value]) => (p as any)[key] === value)) ?? null; } },
    workspace: {
      findUnique: async (q: any) => { calls.push({ model: "slug", ...q }); return collision && slugReads++ === 0 ? { id: "historical-workspace" } : null; },
      create: async (q: any) => { writes.push(q); return { id: "created-workspace", ...q.data }; },
      update: () => { throw Error("Unexpected reassignment"); }, upsert: () => { throw Error("Unexpected reactivation"); },
    },
  };
  const context = loadTestModule("lib/workspace-portfolio-context.ts", { "@/lib/prisma": { prisma } });
  const auth = { getCurrentPrismaUser: async () => { calls.push({ model: "auth" }); if (!owner) throw Error("LOGIN"); return { id: owner }; } };
  const actions = loadTestModule("lib/governance-workspace-actions.ts", {
    "@/lib/template-mutation-access": { getTemplateMutationAccess: () => { throw Error("Unexpected template mutation during Workspace creation"); } },
    "@/lib/prisma": { prisma }, "@/lib/auth": auth, "@/lib/workspace-portfolio-context": context,
    "@/lib/governance-workspace-repository": {}, "next/cache": { revalidatePath: (p: string) => invalidated.push(p) },
    "next/navigation": { redirect: (p: string) => { throw Error(`REDIRECT ${p}`); } },
  });
  const page = loadTestModule("app/(connected)/gouvernance/workspaces/nouveau/page.tsx", {
    "react/jsx-runtime": jsx, "@/lib/auth": auth, "@/lib/workspace-portfolio-context": context,
    "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); } },
    "@/components/WorkspaceCreationForm": { WorkspaceCreationForm: ({ portfolio }: any) => jsx.jsx("p", { children: portfolio?.name ?? "global" }) },
  });
  return { actions, context, page, calls, writes, invalidated };
}
function data(portfolioId?: string) { const form = new FormData(); form.set("name", "  Suivi clients  "); form.set("description", "Description"); if (portfolioId !== undefined) form.set("portfolioId", portfolioId); return form; }

test("active owned Portfolio creates the Workspace already attached and redirects to its detail", async () => {
  const s = setup(); await assert.rejects(s.actions.createWorkspaceAction(data(active.id)), /REDIRECT \/gouvernance\/workspaces\/created-workspace/);
  assert.equal(s.writes.length, 1); assert.equal(s.writes[0].data.portfolioId, active.id); assert.equal(s.writes[0].data.ownerId, "owner");
  assert.equal(s.writes[0].data.name, "Suivi clients"); assert.equal(s.writes[0].data.category, "OTHER"); assert.equal(s.writes[0].data.kind, "GOVERNANCE");
  assert.deepEqual(s.calls.map(q => q.model), ["auth", "portfolio", "slug"]);
  assert.deepEqual(s.calls[1].where, { id: active.id, ownerId: "owner", status: "ACTIVE" });
  assert.deepEqual(s.invalidated, ["/gouvernance", `/gouvernance/portfolios/${active.id}`]);
  const breadcrumb = spatial.workspaceBreadcrumb({ id: "created-workspace", name: "Suivi clients", ownerId: "owner", portfolio: active });
  assert.deepEqual(breadcrumb.map(i => i.label), ["Accueil", "Mes espaces", "Europe", "Suivi clients"]);
});

test("foreign, missing, archived and manipulated Portfolio values fail before writes or slug allocation", async () => {
  for (const id of ["portfolio-foreign", "missing", "portfolio-archived", "portfolio-owned/../foreign", " "]) {
    const s = setup(); await assert.rejects(s.actions.createWorkspaceAction(data(id)));
    assert.equal(s.writes.length, 0); assert.ok(!s.calls.some(q => q.model === "slug"));
  }
  const duplicate = setup(); const form = data(active.id); form.append("portfolioId", "portfolio-foreign");
  await assert.rejects(duplicate.actions.createWorkspaceAction(form), /Contexte Portfolio invalide/); assert.equal(duplicate.writes.length, 0);
  const file = setup(); const uploaded = data(); uploaded.set("portfolioId", new Blob(["portfolio-owned"]), "id.txt");
  await assert.rejects(file.actions.createWorkspaceAction(uploaded), /Contexte Portfolio invalide/); assert.equal(file.writes.length, 0);
  const anonymous = setup(null); await assert.rejects(anonymous.actions.createWorkspaceAction(data(active.id)), /LOGIN/); assert.deepEqual(anonymous.calls, [{ model: "auth" }]);
});

test("no Portfolio preserves global creation, field defaults and redirect", async () => {
  const s = setup(); const form = data(); form.set("category", "CLIENT"); form.set("kind", "MIXED");
  await assert.rejects(s.actions.createWorkspaceAction(form), /^Error: REDIRECT \/gouvernance$/);
  assert.equal(s.writes[0].data.portfolioId, null); assert.equal(s.writes[0].data.category, "CLIENT"); assert.equal(s.writes[0].data.kind, "MIXED");
  assert.ok(!s.calls.some(q => q.model === "portfolio"));
  const invalid = setup(); const bad = data(active.id); bad.set("name", "x");
  await assert.rejects(invalid.actions.createWorkspaceAction(bad), /nom du Workspace/); assert.equal(invalid.writes.length, 0);
});

test("existing name/slug creates a new Workspace without reactivating or moving the historical one", async () => {
  for (const id of [undefined, active.id]) {
    const s = setup("owner", true);
    await assert.rejects(s.actions.createWorkspaceAction(data(id)), /REDIRECT/);
    assert.equal(s.writes.length, 1); assert.notEqual(s.writes[0].data.slug, "suivi-clients");
    assert.equal(s.writes[0].data.portfolioId, id ?? null);
    assert.equal(s.calls.filter(q => q.model === "slug").length, 2);
  }
  const historical = readFileSync("lib/governance-journey-actions.ts", "utf8");
  assert.match(historical, /workspace\.upsert\(/);
  assert.match(historical, /update: \{\s*status: "ACTIVE",\s*\}/);
});

test("form page checks owner/active context, rejects ambiguous query parameters and keeps global mode", async () => {
  const s = setup(); const page = await s.page.default({ searchParams: { portfolioId: active.id } });
  assert.equal(renderToStaticMarkup(page), "<p>Europe</p>");
  assert.equal(renderToStaticMarkup(await s.page.default({ searchParams: {} })), "<p>global</p>");
  for (const id of ["portfolio-foreign", "missing", "portfolio-archived", "", [active.id, "portfolio-foreign"]]) {
    await assert.rejects(s.page.default({ searchParams: { portfolioId: id } }), /NOT_FOUND/);
  }
  const anonymous = setup(null); await assert.rejects(anonymous.page.default({ searchParams: { portfolioId: active.id } }), /LOGIN/);
  assert.equal(s.writes.length, 0);
});

test("mutation rechecks Portfolio even after successful form preselection", async () => {
  const s = setup(); await s.page.default({ searchParams: { portfolioId: active.id } });
  const previous = active.status;
  try { active.status = "ARCHIVED"; await assert.rejects(s.actions.createWorkspaceAction(data(active.id)), /Portfolio cible introuvable/); }
  finally { active.status = previous; }
  assert.equal(s.writes.length, 0); assert.equal(s.calls.filter(q => q.model === "portfolio").length, 2);
});

const base = { react: React, "react/jsx-runtime": jsx, "next/link": ({ children, ...props }: any) => jsx.jsx("a", { ...props, children }), "@/lib/spatial-navigation": spatial };
const menu = loadTestModule("components/SpacesCreateActions.tsx", base);
const view = loadTestModule("components/WorkspaceCreationForm.tsx", { ...base,
  "@/components/SpatialNavigationContext": { PageNavigationContext: ({ items }: any) => jsx.jsx("nav", { children: items.map((i: any) => i.label).join(" > ") }) },
  "@/lib/governance-workspace-actions": { createWorkspaceAction: "/create" },
  "@/lib/governance-workspace-repository": { workspaceCategoryLabels: { OTHER: "Autre" }, workspaceKindLabels: { GOVERNANCE: "Gouvernance" } },
});

test("Portfolio menu offers only contextual Workspace; global menu remains unchanged", () => {
  const html = renderToStaticMarkup(jsx.jsx(menu.SpacesCreateActions, { portfolioId: active.id }));
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.ok(html.includes(`/gouvernance/workspaces/nouveau?portfolioId=${active.id}`));
  assert.ok(html.includes("+ Nouveau") && html.includes(">Workspace</a>"));
  const global = renderToStaticMarkup(jsx.jsx(menu.SpacesCreateActions, {}));
  assert.equal((global.match(/<a /g) ?? []).length, 2); assert.ok(!global.includes("portfolioId="));
});

test("same form shows real Portfolio name, hidden context and scoped cancellation without a selector", () => {
  const html = renderToStaticMarkup(jsx.jsx(view.WorkspaceCreationForm, { portfolio: active }));
  assert.ok(html.includes("Accueil &gt; Mes espaces &gt; Europe &gt; Créer un Workspace"));
  assert.ok(html.includes('aria-label="Portfolio"') && html.includes(">Europe</p>"));
  assert.equal((html.match(/name="portfolioId"/g) ?? []).length, 1);
  assert.ok(html.includes(`type="hidden" name="portfolioId" value="${active.id}"`));
  assert.ok(html.includes(`href="/gouvernance/portfolios/${active.id}"`));
  assert.ok(!html.includes(`<select name="portfolioId"`));
  const global = renderToStaticMarkup(jsx.jsx(view.WorkspaceCreationForm, {}));
  assert.ok(!global.includes('name="portfolioId"') && !global.includes('aria-label="Portfolio"'));
  for (const name of ["name", "description", "category", "kind"]) assert.ok(html.includes(`name="${name}"`) && global.includes(`name="${name}"`));
  assert.equal(spatial.logicalParent(spatial.workspaceCreationBreadcrumb(active))?.href, `/gouvernance/portfolios/${active.id}`);
});

test("creation has no borrowed collection guide or sensitive Boussole context; failures have an accessible boundary", () => {
  assert.equal(getCompassContext("/gouvernance/workspaces/nouveau", `?portfolioId=${active.id}`), null);
  assert.equal(getCompassContext("/gouvernance/portfolios/portfolio-owned")?.id, "portfolio-detail");
  assert.equal(getBoussoleJourneyVersion("explore-portfolio"), 1);
  const boundary = loadTestModule("app/(connected)/gouvernance/workspaces/nouveau/error.tsx", base);
  const html = renderToStaticMarkup(jsx.jsx(boundary.default, { error: Error("Sensitive detail"), reset: () => {} }));
  assert.ok(html.includes('role="alert"') && html.includes("Réessayer")); assert.ok(!html.includes("Sensitive detail"));
});
