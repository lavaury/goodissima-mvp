import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("dashboard surfaces compact Champagne card behind admin or tester roles", () => {
  const dashboard = source("app/dashboard/page.tsx");
  const card = source("components/ChampagneDashboardCard.tsx");

  assert.match(dashboard, /ChampagneDashboardCard/);
  assert.match(dashboard, /canAccessChampagneWorkspace\(owner\.role\)/);
  assert.match(card, /Tests Champagne/);
  assert.match(card, /Valider les grands scénarios Goodissima/);
  assert.match(card, /Ouvrir les tests/);
  assert.match(card, /\/administration#tests-champagne/);
  assert.match(card, /champagneScenarioCount/);
  assert.doesNotMatch(dashboard, /role[^;]+OWNER/);
});

test("administration keeps the full Champagne panel behind the same role gate", () => {
  const administration = source("app/administration/page.tsx");
  const roles = source("lib/champagne-workspace.ts");

  assert.match(administration, /ChampagneScenariosPanel/);
  assert.match(administration, /id="tests-champagne"/);
  assert.match(administration, /canAccessChampagneWorkspace\(owner\.role\)/);
  assert.match(roles, /"ADMIN"/);
  assert.match(roles, /"TESTER"/);
  assert.match(roles, /"PRODUCT_OWNER"/);
  assert.match(roles, /"SUPER_ADMIN"/);
});

test("Champagne scenarios stay in real product routes and avoid isolated demo UX", () => {
  const panel = source("components/ChampagneScenariosPanel.tsx");

  for (const title of [
    "Recrutement intelligent",
    "Prospection inversée",
    "Dossier complexe multi-acteurs",
    "QR Code / lien sécurisé",
    "Multi-matching",
    "Cercle / hashtag",
  ]) {
    assert.match(panel, new RegExp(title));
  }

  for (const route of ["/opportunities/new", "/parcours", "/relations", "/ia-valeur", "/opportunities"]) {
    assert.match(panel, new RegExp(route.replace("/", "\\/")));
  }

  assert.doesNotMatch(panel, /\/experience\/champagne/);
  assert.doesNotMatch(panel, /\/demo\/champagne/);
  assert.match(panel, /Vision future/);
});

test("Champagne cards expose required controls, labels, and safety copy", () => {
  const panel = source("components/ChampagneScenariosPanel.tsx");

  for (const text of [
    "Données fictives certifiées pour test",
    "Aucune notification réelle",
    "aucun contact",
    "message externe",
    "publication ou décision automatique",
    "Lancer le scénario",
    "Voir les étapes",
    "Réinitialiser les données de test",
    "Marquer comme testé",
    "prêt",
    "à tester",
    "terminé",
    "localStorage",
    "not_started",
    "in_progress",
    "completed",
    "failed",
  ]) {
    assert.match(panel, new RegExp(text));
  }
});
