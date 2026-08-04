import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GJ-4 UI is owner-side, read-only and does not render technical identifiers", async () => {
  const paths = [
    "../components/governed-journey/GovernedJourneyPresenters.tsx",
    "../app/cases/[caseId]/journeys/page.tsx",
    "../app/cases/[caseId]/journeys/[journeyId]/page.tsx",
  ];
  const source = (await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
  assert.match(source, /Parcours gouvernés/);
  assert.match(source, /Aucun parcours gouverné n’est rattaché/);
  assert.match(source, /Aucun statut antérieur/);
  assert.match(source, /Historique/);
  assert.match(source, /getCurrentPrismaUser/);
  assert.doesNotMatch(source, /<form|<button|memory\/|Mémoire/);
  assert.doesNotMatch(source, />\s*\{journey\.id\}\s*</);
});
