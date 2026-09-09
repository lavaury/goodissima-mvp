import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { shellModules, renderShellFixture } from "./helpers/render-connected-shell.ts";

const require = createRequire(import.meta.url);
const { normalizeAppPath } = require("next/dist/shared/lib/router/utils/app-paths");
const expected: { connected: string[]; excluded: string[]; handlers: string[] } = JSON.parse(readFileSync(new URL("./fixtures/connected-routes.json", import.meta.url), "utf8"));
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}
const layoutRoleDependencies = {
  "next/cache": { unstable_noStore() {} },
  "@/lib/ai-value-access": { canAccessAIValue: (role: string) => role === "ADMIN" || role === "SUPER_ADMIN" },
  "@/lib/access-invitations": { normalizeInvitationEmail: (email: string) => email },
  "@/lib/prisma": { prisma: { user: { findUnique: async () => ({ role: "OWNER" }) } } },
};
const appFiles = files("app");
const routeOf = (file: string) => normalizeAppPath("/" + file.slice(4).replace(/\.(tsx?|js)$/, ""));

test("all 50 page URLs and all 84 handlers match the inventory including Alerts, without duplicates", () => {
  const pages = appFiles.filter(f => f.endsWith("/page.tsx"));
  const actual = pages.map(routeOf).sort();
  assert.deepEqual(actual, [...expected.connected, ...expected.excluded].sort());
  assert.equal(new Set(actual).size, 50);
  assert.deepEqual(appFiles.filter(f => f.endsWith("/route.ts")).map(routeOf).sort(), expected.handlers);
  assert.equal(expected.handlers.length, 84);
  assert.ok(appFiles.filter(f => f.endsWith("/route.ts")).every(f => !f.includes("(connected)")));
});

for (const route of expected.connected) {
  test(`A ${route} inherits the only connected layout and retains its page authorization`, async () => {
    const file = `app/(connected)${route}/page.tsx`;
    const source = read(file);
    assert.doesNotMatch(source, /<PlatformNavigation|<ConnectedShell|<LogoutButton/);
    if (route !== "/parcours" && route !== "/ia-valeur") assert.match(source, /await (?:getCurrentPrismaUser|requireCurrentUser|listFavorites)\(/);
    const { ConnectedShell } = shellModules(route);
    let reads = 0;
    const layout = loadTestModule("app/(connected)/layout.tsx", { ...layoutRoleDependencies, "react/jsx-runtime": jsx,
      "@/components/ConnectedShell": { ConnectedShell },
      "@/lib/auth": { requireCurrentUser: async () => { reads++; return { email: "fixture@example.test", user_metadata: { name: "Fixture organisation" } }; } } });
    const html = renderToStaticMarkup(await layout.default({ children: jsx.jsx("main", { children: `Content ${route}` }) }));
    assert.equal(reads, 1);
    assert.equal((html.match(/data-connected-shell="true"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-label="Navigation principale"/g) ?? []).length, 1);
    assert.ok(html.includes(`Content ${route}`));
    assert.ok(html.includes("Fixture organisation"));
  });
}

test("connected layout propagates the existing unauthenticated redirect before rendering", async () => {
  const redirect = new Error("NEXT_REDIRECT: /login");
  const layout = loadTestModule("app/(connected)/layout.tsx", { ...layoutRoleDependencies,
    "react/jsx-runtime": jsx,
    "@/components/ConnectedShell": { ConnectedShell: () => { throw new Error("Unexpected render"); } },
    "@/lib/auth": { requireCurrentUser: async () => { throw redirect; } },
  });
  await assert.rejects(layout.default({ children: null }), error => error === redirect);
});

for (const route of expected.excluded) {
  test(`B/C ${route} stays outside ConnectedShell, even with an owner session`, () => {
    const file = route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
    assert.ok(appFiles.includes(file));
    assert.doesNotMatch(read(file), /ConnectedShell|PlatformNavigation/);
    const root = loadTestModule("app/layout.tsx", {
      "./globals.css": {}, "react/jsx-runtime": jsx,
      "@/components/FeedbackButton": { FeedbackButton: () => null },
      "@/components/GlobalLanguageSwitcher": { GlobalLanguageSwitcher: () => null },
      "@/components/I18nProvider": { I18nProvider: ({ children }: any) => children },
      "@/components/ToastProvider": { ToastProvider: ({ children }: any) => children },
      "@/lib/i18n": { getI18n: () => ({ locale: "fr", messages: {} }) },
      // No auth import is permitted: session presence cannot change this boundary.
    });
    const html = renderToStaticMarkup(root.default({ children: jsx.jsx("main", { children: "Excluded content" }) }));
    assert.doesNotMatch(html, /data-connected-shell|Navigation principale/);
    assert.match(html, /Excluded content/);
  });
}

test("root is neutral; one connected layout and one navigation mount; utilities are scoped individually", () => {
  assert.deepEqual(appFiles.filter(f => f.endsWith("/layout.tsx")).sort(), ["app/(connected)/layout.tsx", "app/layout.tsx"]);
  assert.doesNotMatch(read("app/layout.tsx"), /ContextualBoussole|ConnectedShell|requireCurrentUser|getCurrentPrismaUser/);
  assert.doesNotMatch(read("app/(connected)/layout.tsx"), /await getCurrentPrismaUser|\.(?:upsert|create|update|delete)\(/);
  for (const utility of ["ToastProvider", "I18nProvider", "FeedbackButton", "GlobalLanguageSwitcher"]) assert.match(read("app/layout.tsx"), new RegExp(`<${utility}`));
  assert.match(read("components/ConnectedShell.tsx"), /<ContextualBoussole/);
  assert.equal(files("components").concat(appFiles).filter(f => /\.tsx$/.test(f)).reduce((n,f) => n+(read(f).match(/<PlatformNavigation\b/g)??[]).length, 0), 1);
});

test("logo links accessibly to Dashboard, content has its own main, and non-admin destinations remain", () => {
  const html = renderShellFixture();
  assert.ok(!html.includes('href="/ia-valeur"'));
  assert.match(html, /href="\/dashboard" aria-label="Goodissima — Accueil"/);
  assert.match(html, /alt="Goodissima"/);
  assert.equal((html.match(/<main\b/g)??[]).length, 1);
  const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  assert.equal((nav.match(/<a\b/g)??[]).length, 3);
  for (const href of ["/boussole/decouverte", "/annuaire", "/gouvernance"]) assert.ok(nav.includes(`href="${href}"`));
  for (const href of ["/dashboard", "/gouvernance", "/annuaire", "/identity", "/boussole/decouverte", "/administration", "/favoris", "/recherche"]) assert.ok(html.includes(`href="${href}"`), href);
  assert.equal((html.match(/data-boussole-id="dashboard-menu"/g)??[]).length, 1);
  assert.doesNotMatch(renderShellFixture("/annuaire"), /data-boussole-id="dashboard-menu"/);
});

test("main navigation identifies the current area, including governed descendants and aliases", () => {
  for (const [route, active] of Object.entries({
    "/annuaire": "/annuaire", "/boussole": "/boussole/decouverte",
    "/boussole/decouverte": "/boussole/decouverte", "/gouvernance": "/gouvernance",
    "/gouvernance/portfolios/p1/pilotage": "/gouvernance", "/gouvernance/parcours/p1/pilotage": "/gouvernance",
    "/gouvernance/pilotage": "/gouvernance", "/cases": "/gouvernance", "/cases/c1": "/gouvernance",
    "/parcours": "/gouvernance", "/templates/t1": "/gouvernance",
  })) {
    const html = renderShellFixture(route);
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    const current = nav.match(/<a\b[^>]*aria-current="(?:page|location)"[^>]*>/g) ?? [];
    assert.equal(current.length, 1, route);
    assert.ok(current[0].includes(`href="${active}"`), route);
  }
});

test("both aliases re-export the original implementations and dynamic settings", () => {
  for (const [alias,target] of [["parcours","templates"],["ia-valeur","admin/ai-costs"]]) {
    const marker = () => null;
    const result = loadTestModule(`app/(connected)/${alias}/page.tsx`, { [`@/app/(connected)/${target}/page`]: { __esModule: true, default: marker, dynamic: "force-dynamic" } });
    assert.equal(result.default, marker);
    assert.equal(result.dynamic, "force-dynamic");
  }
});

test("connected notifications reserve space before the shell; guest placement stays fixed", () => {
  for (const connected of [true, false]) {
    const toastReact = { ...React, useState: () => [[{ id: 1, variant: "success", message: "Notification" }], () => {}] };
    const { ToastProvider } = loadTestModule("components/ToastProvider.tsx", {
      react: toastReact, "react/jsx-runtime": jsx,
      "next/navigation": { useSelectedLayoutSegment: () => connected ? "(connected)" : "secure" },
    });
    const html = renderToStaticMarkup(jsx.jsx(ToastProvider, { children: jsx.jsx("main", { children: "Page content" }) }));
    assert.ok(html.indexOf('role="status"') < html.indexOf("<main"));
    assert.equal(html.includes("sticky top-0"), connected);
    assert.equal(html.includes("fixed right-4 top-4"), !connected);
  }
});

test("language control is inline once on A and retains its existing public/guest behavior", () => {
  for (const connected of [true,false]) {
    const { GlobalLanguageSwitcher } = shellModules(connected ? "/dashboard" : "/secure/fixture", connected);
    const html = renderToStaticMarkup(jsx.jsx(GlobalLanguageSwitcher, {}));
    assert.equal(html.includes("Langue"), !connected);
  }
  assert.equal(renderToStaticMarkup(jsx.jsx(shellModules("/",false).GlobalLanguageSwitcher,{})), "");
  const html = renderShellFixture();
  assert.ok(!html.includes('href="/ia-valeur"'));
  assert.equal((html.match(/aria-label="Langue"/g)??[]).length,1);
  assert.doesNotMatch(read("components/ConnectedShell.tsx"), /\bfixed\b|\bsticky\b/);
});
