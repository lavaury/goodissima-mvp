import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ui = read("components/directory/DirectoryExperience.tsx");
const route = read("app/api/directory/interpret-search/route.ts");

test("natural language remains a transparent prefill for deterministic search", () => {
  assert.match(ui, /Décrivez qui vous recherchez/);
  assert.match(ui, /Comprendre ma recherche/);
  assert.match(ui, /Nous avons compris/);
  assert.match(ui, /setForm\(\{ text: criteria\.text/);
  assert.match(ui, /fetch\("\/api\/directory\/search"/);
  assert.doesNotMatch(ui, /interpret\(\)[\s\S]{0,300}search\(/);
});

test("loading, correction, unsupported, reset and fallback are accessible", () => {
  for (const copy of ["Interprétation…", "Critères non pris en charge", "Ce critère n’est pas encore pris en charge", "Réinitialiser", "Vous pouvez utiliser les filtres ci-dessous"]) assert.match(ui, new RegExp(copy));
  for (const token of ["aria-live", "role=\"alert\"", "role=\"status\"", "focus-visible", "min-h-11", "sm:", "md:", "lg:"]) assert.match(ui, new RegExp(token));
  assert.match(ui, /type="checkbox"/);
});

test("authenticated route sends no private context and failure does not block filters", () => {
  assert.match(route, /getCurrentPrismaUser\(\)/);
  assert.match(route, /interpretDirectorySearch\(query/);
  assert.doesNotMatch(route, /from ["']@\/lib\/prisma|Workspace|RelationCase|credential|claim|email/i);
  assert.match(route, /status: 503/);
});
