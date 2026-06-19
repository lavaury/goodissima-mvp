import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("dashboard primary CTA is opportunity-first", () => {
  const dashboard = source("app/dashboard/page.tsx");
  const fr = source("locales/fr/common.json");
  assert.match(fr, /"dashboard.title": "Mes opportunités et relations"/);
  assert.match(fr, /"dashboard.createLink": "Créer une opportunité"/);
  assert.match(dashboard, /href="\/opportunities\/new" className="rounded-2xl bg-slate-900/);
  assert.doesNotMatch(dashboard, /href="\/links\/new" className="rounded-2xl bg-slate-900/);
});

test("opportunity creation clarifies IA assisted and manual modes", () => {
  const page = source("app/opportunities/new/page.tsx");
  assert.match(page, /Assisté par IA/);
  assert.match(page, /Manuel/);
  assert.match(page, /Choisir le mode de création/);
  assert.match(page, /Rien n'est publié, validé ou envoyé automatiquement/);
});

test("secure link wording remains scoped to published announcement contexts", () => {
  const opportunities = source("app/opportunities/page.tsx");
  const creation = source("app/opportunities/new/page.tsx");
  const actions = source("components/OpportunityPreviewActions.tsx");
  assert.doesNotMatch(opportunities, /Créer un lien sécurisé/);
  assert.match(creation, /Créer un lien sécurisé dans le contexte d'une annonce prête à être partagée/);
  assert.match(actions, /Créer un lien sécurisé/);
});

test("public home is authentication-first and dashboard search remains opportunity-first", () => {
  const home = source("app/page.tsx");
  const loginEntry = source("components/LoginEntry.tsx");
  const filters = source("components/DashboardLinkFilters.tsx");
  assert.match(home, /LoginEntry/);
  assert.match(loginEntry, /Se connecter/);
  assert.match(loginEntry, /Créer un accès/);
  assert.doesNotMatch(loginEntry, /href="\/opportunities\/new"/);
  assert.match(filters, /Rechercher une opportunité/);
  assert.match(filters, /Aucune opportunité correspondante/);
});
