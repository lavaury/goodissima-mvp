import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { welcomeEntries } from "../lib/boussole/welcome-content.ts";
import { welcomeManifest } from "../lib/boussole/welcome-manifest.ts";
import { WELCOME_STEP_IDS } from "../lib/boussole/welcome-contracts.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dashboard = source("app/dashboard/page.tsx");
const navigation = source("components/PlatformNavigation.tsx");
const discoveryPage = source("app/boussole/decouverte/page.tsx");

test("dashboard exposes a compact canonical Boussole entry in empty and active states", () => {
  assert.match(dashboard, /data-boussole-id="open-boussole-from-dashboard"/);
  assert.match(dashboard, /href="\/boussole\/decouverte"/);
  assert.match(dashboard, /Ouvrir la Boussole/);
  assert.match(dashboard, /const hasDashboardActivity = links\.length > 0 \|\| cases\.length > 0/);
  assert.match(dashboard, /hasDashboardActivity\s*\?/);
  assert.match(dashboard, /Vous ne savez pas par où commencer/);
  assert.match(dashboard, /<DashboardLinkFilters/);
});

test("global navigation links canonically to discovery on desktop and mobile", () => {
  assert.match(navigation, /\{ label: "Boussole", href: "\/boussole\/decouverte" \}/);
  assert.match(navigation, /data-boussole-id=\{boussoleIds\[item\.href\]\}/);
  assert.match(navigation, /"\/boussole\/decouverte": "open-boussole-from-navigation"/);
  assert.match(navigation, /overflow-x-auto/);
  assert.match(navigation, /aria-label="Navigation principale"/);
});

test("discovery page renders the connected navigation with an explicit active state", () => {
  assert.match(discoveryPage, /<PlatformNavigation active="boussole" \/>/);
  assert.match(navigation, /active === "boussole"[\s\S]*\? "\/boussole\/decouverte"/);
  assert.match(navigation, /aria-current=\{item\.href === resolvedActiveHref \? "page" : undefined\}/);
  assert.match(discoveryPage, /<Link href="\/dashboard"/);
});

test("integration adds no redirect, autoplay, AI call or automatic business effect", () => {
  const dashboardCard = dashboard.slice(
    dashboard.indexOf('data-boussole-id="open-boussole-from-dashboard"'),
    dashboard.indexOf('<section className="mb-8 rounded-3xl'),
  );
  const integration = `${dashboardCard}\n${navigation}\n${discoveryPage}`;
  assert.doesNotMatch(integration, /\bredirect\s*\(|router\.(?:push|replace)\s*\(|location\.(?:assign|replace)/);
  assert.doesNotMatch(integration, /\bautoPlay\b|\.play\s*\(/);
  assert.doesNotMatch(integration, /\/api\/boussole|Mistral|openai|generate[A-Z]/i);
  assert.doesNotMatch(integration, /prisma\.\w+\.create|sendEmail|notification|invitation/i);
});

test("welcome contracts remain unchanged by navigation integration", () => {
  assert.equal(welcomeEntries.length, 4);
  assert.deepEqual(welcomeEntries.map((entry) => entry.route), [
    "/links/simple",
    "/opportunities/new",
    "/gouvernance/nouveau",
    "/dashboard",
  ]);
  assert.equal(WELCOME_STEP_IDS["welcome-discover"].length, 6);
  assert.ok(welcomeManifest.journeys.every((journey) => journey.version === 1));
  assert.deepEqual(welcomeManifest.applicableStates, ["EMPTY"]);
});

test("modified UI files contain no common UTF-8 corruption markers", () => {
  const markers = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\u00ef\u00bf\u00bd"];
  for (const [path, content] of [
    ["app/dashboard/page.tsx", dashboard],
    ["components/PlatformNavigation.tsx", navigation],
    ["app/boussole/decouverte/page.tsx", discoveryPage],
  ]) {
    for (const marker of markers) assert.equal(content.includes(marker), false, `${path}: corrupt UTF-8`);
  }
});
