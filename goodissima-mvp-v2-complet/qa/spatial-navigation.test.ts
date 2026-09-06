import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createConnectedHistory } from "../lib/connected-history.ts";
import { businessLabel, isConnectedPathname, logicalParent, objectBreadcrumb, pageBreadcrumb, portfolioBreadcrumb } from "../lib/spatial-navigation.ts";
import { renderShellFixture } from "./helpers/render-connected-shell.ts";

const a = { key: "native-a", index: 0 };
const b = { key: "native-b", index: 1 };
const c = { key: "native-c", index: 1 };
const none = { back: false, forward: false };

test("native A -> B -> back -> forward uses observed adjacent entries", () => {
  const history = createConnectedHistory();
  assert.deepEqual(history.observe([a], a, true), none);
  assert.deepEqual(history.observe([a, b], b, true), { back: true, forward: false });
  assert.deepEqual(history.observe([a, b], a, true), { back: false, forward: true });
  assert.deepEqual(history.observe([a, b], b, true), { back: true, forward: false });
});

test("a new branch after back discards the former forward entry", () => {
  const history = createConnectedHistory();
  history.observe([a], a, true);
  history.observe([a, b], b, true);
  history.observe([a, b], a, true);
  assert.deepEqual(history.observe([a, c], c, true), { back: true, forward: false });
  assert.deepEqual(history.observe([a, c], a, true), { back: false, forward: true });
});

test("direct arrival, new tab and remount never infer history from its length", () => {
  assert.deepEqual(createConnectedHistory().observe([a, b], b, true), none);
  assert.deepEqual(createConnectedHistory().observe([a], a, true), none);
  assert.deepEqual(createConnectedHistory().observe([], null, true), none);
});

test("leaving the connected surface forgets previously observed entries", () => {
  const history = createConnectedHistory();
  history.observe([a], a, true);
  assert.deepEqual(history.observe([a, b], b, false), none);
  assert.deepEqual(history.observe([a, b], a, true), none);
});

test("unknown adjacent entries and discontinuous native indexes are disabled", () => {
  const history = createConnectedHistory();
  history.observe([a], a, true);
  const distant = { key: "native-distant", index: 3 };
  assert.deepEqual(history.observe([a, distant], distant, true), none);
  assert.deepEqual(history.observe([a, b, distant], a, true), none);
});

test("a replaced native entry preserves known neighboring history", () => {
  const history = createConnectedHistory();
  history.observe([a], a, true);
  history.observe([a, b], b, true);
  assert.deepEqual(history.observe([a, c], c, true), { back: true, forward: false });
});

test("history never reads entry URLs or states", () => {
  const entry = Object.defineProperties({ ...a }, {
    url: { get() { throw new Error("Do not read URLs"); } },
    getState: { get() { throw new Error("Do not read native state"); } },
  });
  assert.deepEqual(createConnectedHistory().observe([entry], entry, true), none);
});

test("all owner page patterns including Workspace are eligible for observed history", () => {
  const routes = JSON.parse(readFileSync(new URL("./fixtures/connected-routes.json", import.meta.url), "utf8"));
  for (const route of routes.connected) assert.equal(isConnectedPathname(route), true, route);
  for (const route of [...routes.excluded, ...routes.handlers, "/gouvernance/invitation/private-token", "/secure/private-token", "/l/private-slug"]) assert.equal(isConnectedPathname(route), false, route);
});

test("global pages use explicit business vocabulary", () => {
  for (const [pathname, label] of Object.entries({ "/boussole": "Boussole", "/boussole/decouverte": "Boussole", "/annuaire": "Annuaire", "/gouvernance": "Mes espaces", "/identity": "Identité", "/settings": "Paramètres" })) {
    assert.deepEqual(pageBreadcrumb(pathname), [{ label: "Accueil", href: "/dashboard" }, { label }]);
  }
  assert.deepEqual(pageBreadcrumb("/dashboard"), [{ label: "Accueil" }]);
  assert.equal(logicalParent(pageBreadcrumb("/dashboard")), null);
});

const portfolio = { id: "portfolio-private-id", name: "Portfolio Europe", ownerId: "owner" };
const workspace = { id: "workspace-private-id", name: "Workspace Contentieux", ownerId: "owner", portfolio };
const object = { name: "Parcours Martin", fallback: "Parcours gouverné", objectId: "object-private-id", ownerId: "owner" };

test("Portfolio + Workspace + object use real names and go up to Workspace", () => {
  const items = objectBreadcrumb({ ...object, workspace });
  assert.deepEqual(items.map(item => item.label), ["Accueil", "Mes espaces", "Portfolio Europe", "Workspace Contentieux", "Parcours Martin"]);
  assert.equal(items[3].href, "/gouvernance/workspaces/workspace-private-id");
  assert.equal(logicalParent(items)?.href, "/gouvernance/workspaces/workspace-private-id");
});

test("object in Workspace without Portfolio goes up to Workspace", () => {
  const items = objectBreadcrumb({ ...object, workspace: { ...workspace, portfolio: null } });
  assert.deepEqual(items.map(item => item.label), ["Accueil", "Mes espaces", "Workspace Contentieux", "Parcours Martin"]);
  assert.equal(logicalParent(items)?.href, "/gouvernance/workspaces/workspace-private-id");
});

test("an object without Workspace invents neither a Workspace nor a Portfolio", () => {
  const items = objectBreadcrumb(object);
  assert.deepEqual(items.map(item => item.label), ["Accueil", "Mes espaces", "Parcours Martin"]);
  assert.equal(logicalParent(items)?.href, "/gouvernance");
});

test("unowned relation labels and links are not published in navigation", () => {
  assert.deepEqual(objectBreadcrumb({ ...object, workspace: { ...workspace, ownerId: "other" } }), objectBreadcrumb(object));
  const items = objectBreadcrumb({ ...object, workspace: { ...workspace, portfolio: { ...portfolio, ownerId: "other" } } });
  assert.ok(!items.some(item => item.label === portfolio.name));
  assert.equal(logicalParent(items)?.href, "/gouvernance/workspaces/workspace-private-id");
});

test("Portfolio detail and pilotage have justified clickable parents", () => {
  assert.equal(logicalParent(portfolioBreadcrumb(portfolio))?.href, "/gouvernance");
  assert.equal(logicalParent(portfolioBreadcrumb(portfolio, true))?.href, "/gouvernance/portfolios/portfolio-private-id");
  assert.equal(logicalParent([{ label: "Workspace" }, { label: "Objet" }]), null);
  assert.equal(logicalParent([{ label: "Objet" }]), null);
});

test("technical IDs, UUIDs, token-bearing URLs and missing names use safe labels", () => {
  for (const name of ["", "object-private-id", "123e4567-e89b-12d3-a456-426614174000", "c" + "m".repeat(24), "https://example.test/secure/private-token", "token=private-token", "a".repeat(64)]) {
    assert.equal(businessLabel(name, "Objet", ["object-private-id"]), "Objet", name);
  }
  assert.equal(businessLabel("Contrat Martin", "Objet"), "Contrat Martin");
  const labels = pageBreadcrumb("/cases/private-token").map(item => item.label).join(" ");
  assert.ok(!labels.includes("private-token"));
});

test("rendered spatial controls are disabled on direct SSR arrival and home is consistent", () => {
  const html = renderShellFixture("/dashboard");
  assert.match(html, /aria-label="Retour à l’écran précédent"[^>]*disabled/);
  assert.match(html, /aria-label="Suivant dans l’historique"[^>]*disabled/);
  assert.match(html, /aria-label="Remonter au niveau supérieur"[^>]*disabled/);
  assert.match(html, /href="\/dashboard" aria-label="Accueil Goodissima"/);
  assert.match(html, /href="\/dashboard" aria-label="Goodissima — Accueil"/);
  assert.match(html, /aria-label="Fil d’Ariane"/);
  assert.match(html, /aria-current="page"[^>]*>Accueil/);
});

test("object parent remains disabled before its authorized page context arrives", () => {
  const html = renderShellFixture("/cases/private-id");
  assert.match(html, /aria-label="Remonter au niveau supérieur"[^>]*disabled/);
  assert.ok(!html.includes("private-id"));
});
