import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const page = readFileSync("components/governed-memory/GovernedMemoryPage.tsx", "utf8");
const presenters = readFileSync("components/governed-memory/MemoryPresenters.tsx", "utf8");

test("renders five accessible, read-only memory views", () => {
  for (const label of ["État à une date", "Comparaison", "Timeline", "Décisions", "Accès"]) assert.match(page, new RegExp(label));
  assert.match(page, /role="tablist"/); assert.match(page, /role="tab"/); assert.match(page, /aria-selected/); assert.match(page, /role="tabpanel"/); assert.match(page, /aria-live="polite"/);
  assert.match(page, /Ce qui était connu à cette date/); assert.match(page, /Ce que nous savons aujourd’hui sur cette date/); assert.match(presenters, /RECORDED_LATER/);
});

test("provides loading, prudent empty states, mapped limitations and non-disclosing errors", () => {
  assert.match(page, /Mise à jour en cours/); assert.match(presenters, /Aucun élément consultable n’est disponible/); assert.match(page, /introuvable ou n’est pas accessible/);
  assert.match(presenters, /limitationLabels/); assert.match(presenters, /Certaines limites de reconstruction n’ont pas pu être détaillées/);
});

test("renders governed decision sections without generated causality", () => {
  for (const label of ["Motif déclaré", "Faits explicitement liés", "Sources explicitement liées", "Décisions antérieures liées", "Réserves", "Contestations ouvertes", "Conséquences ultérieures enregistrées", "Limitations"]) assert.match(`${page}\n${presenters}`, new RegExp(label));
  assert.match(page, /ne déduit pas automatiquement les causes/);
  assert.doesNotMatch(page, /reasonGenerated|generatedSummary|dangerouslySetInnerHTML/);
});
