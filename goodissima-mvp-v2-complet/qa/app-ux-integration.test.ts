import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("navigation keeps three global doors and preserves secondary product sections", () => {
  const nav = source("components/PlatformNavigation.tsx");
  for (const label of ["Boussole", "Annuaire", "Mes espaces", "Opportunités", "Parcours", "Relations", "IA & Valeur", "Administration"]) {
    assert.match(nav, new RegExp(label));
  }
  assert.doesNotMatch(nav, /CIRO|Merge internals|templates internals|scoring internals/i);
});

test("dashboard includes executive overview cards and action entry points", () => {
  const page = source("app/(connected)/dashboard/page.tsx");
  for (const label of ["Opportunités actives", "Annonces publiées", "Mises en relation en attente", "Relations en cours", "Templates/parcours actifs", "Coût IA du mois", "Valeur estimée", "Alertes ou actions ouvertes"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /href="\/opportunities\/new"/);
  assert.match(page, /href="\/ia-valeur"/);
  assert.doesNotMatch(page, /href="\/links\/new" className="rounded-2xl bg-slate-900/);
});

test("opportunities page provides the focused collection and lifecycle statuses", () => {
  const page = source("app/(connected)/opportunities/page.tsx");
  const collection = source("components/OpportunityCollection.tsx");
  for (const label of ["Créer une opportunité", "Brouillons", "Publiées", "Suspendues", "Clôturées"]) assert.match(`${page}\n${collection}`, new RegExp(label));
  assert.doesNotMatch(page, /Candidats détectés|Demandes de mise en relation|ProductLifecycle|LinkCard/);
});

test("opportunity creation entry point reuses the governed AI and voice designer", () => {
  const page = source("app/(connected)/opportunities/new/page.tsx");
  assert.match(page, /AITemplateDesigner/);
  assert.match(page, /Assisté par IA/);
  assert.match(page, /Manuel/);
  assert.match(page, /Rien n'est publié, validé ou envoyé automatiquement/);
});

test("parcours entry point keeps journey tooling and user-facing wording", () => {
  const alias = source("app/(connected)/parcours/page.tsx");
  const templates = source("app/(connected)/templates/page.tsx");
  assert.match(alias, /app\/\(connected\)\/templates\/page/);
  assert.match(templates, /Mes parcours/);
  assert.match(templates, /Quality Guard · Critic · Optimizer · versions · audit\/provenance/);
  assert.doesNotMatch(templates, /Retour au studio/);
});

test("relations page exposes the relationship workspace entry point", () => {
  const page = source("app/(connected)/relations/page.tsx");
  for (const label of ["Relations en attente", "Relations acceptées", "Conversation & documents", "demandes relationnelles", "gouvernance", "assistance IA"]) {
    assert.match(page, new RegExp(label, "i"));
  }
  assert.match(page, /href=\{`\/cases\/\$\{relation.id\}`\}/);
});

test("IA value and administration routes expose admin value access", () => {
  const alias = source("app/(connected)/ia-valeur/page.tsx");
  const admin = source("app/(connected)/administration/page.tsx");
  const costs = source("app/(connected)/admin/ai-costs/page.tsx");
  assert.match(alias, /app\/\(connected\)\/admin\/ai-costs\/page/);
  assert.match(admin, /IA & Valeur/);
  assert.match(admin, /Démo · Expérimental/);
  assert.match(costs, /Coût IA, valeur estimée, templates générés, templates validés, versions optimisées, ROI estimé et exports CSV/);
  assert.match(costs, /Exporter en CSV/);
});

test("demo routes remain available but clearly labelled as secondary", () => {
  const experience = source("app/(connected)/experience/page.tsx");
  const templateDemo = source("app/(connected)/templates/demo/page.tsx");
  const matchingDemo = source("app/demo/housing-candidates/page.tsx");
  assert.match(experience, /Démo · Expérimental/);
  assert.match(experience, /href="\/opportunities\/new"/);
  assert.match(templateDemo, /Démo · Expérimental/);
  assert.match(matchingDemo, /Démo · Expérimental/);
  assert.match(matchingDemo, /href="\/relations"/);
});
