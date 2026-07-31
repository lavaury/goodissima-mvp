import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("directory navigation exposes honest Global and functional Moi tabs", () => {
  const page = read("app/annuaire/page.tsx");
  const tabs = read("components/directory/DirectoryTabs.tsx");
  assert.match(tabs, /Global/);
  assert.match(tabs, /Moi/);
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /aria-selected/);
  assert.match(page, /Annuaire global non activé/);
  assert.doesNotMatch(page, /mock|fixture|demoProfile|fakeProfile/i);
});

test("server performs one grouped owner-scoped representation read", () => {
  const page = read("app/annuaire/page.tsx");
  assert.match(page, /listRepresentations\(currentUser\.id\)/);
  assert.doesNotMatch(page, /ownerId|identityId/);
  assert.equal((page.match(/listRepresentations\(/g) ?? []).length, 1);
});

test("Moi has truthful identity, representation, request and contact empty states", () => {
  const overview = read("components/directory/MyDirectoryOverview.tsx");
  for (const text of [
    "Identité Goodissima requise",
    "Créer ma première représentation",
    "Les demandes de contact ne sont pas encore activées.",
    "Les contacts de l’annuaire ne sont pas encore activés.",
  ]) assert.ok(overview.includes(text));
  assert.match(overview, /href="\/identity"/);
  assert.doesNotMatch(overview, /contactCount|requestCount|badgeCount/);
});

test("editor reuses Lot 1 validation and prevents duplicate submission", () => {
  const editor = read("components/directory/RepresentationEditor.tsx");
  assert.match(editor, /parseCreateRepresentationInput/);
  assert.match(editor, /parseUpdateRepresentationInput/);
  assert.match(editor, /if \(submitting\) return/);
  assert.match(editor, /disabled=\{submitting\}/);
  assert.match(editor, /expectedUpdatedAt: representation\.updatedAt/);
  assert.match(editor, /privée et n’apparaît pas dans l’Annuaire global/);
  for (const field of ["displayName", "type", "title", "organizationName", "territory", "description"]) assert.match(editor, new RegExp(`\\b${field}\\b`));
});

test("real API responses refresh create, edit and all explicit transitions", () => {
  const overview = read("components/directory/MyDirectoryOverview.tsx");
  const card = read("components/directory/RepresentationCard.tsx");
  assert.match(overview, /payload\.representation/);
  assert.match(overview, /router\.refresh\(\)/);
  assert.match(overview, /window\.confirm/);
  assert.match(overview, /response\.status === 409/);
  for (const action of ["hide", "restore", "archive"]) assert.match(overview, new RegExp(`"${action}"`));
  for (const label of ["Modifier", "Masquer", "Réactiver", "Archiver", "Restaurer"]) assert.ok(card.includes(label));
  assert.match(card, /status !== "ARCHIVED"/);
});

test("cards expose readable types and statuses without sensitive identifiers", () => {
  const ui = read("components/directory/directory-ui.ts");
  const card = read("components/directory/RepresentationCard.tsx");
  for (const label of ["Professionnel", "Représentant d’une organisation", "Association", "Privé", "Autre", "Active", "Masquée", "Archivée"]) assert.ok(ui.includes(label));
  assert.match(ui, /ACTIVE: 0, HIDDEN: 1, ARCHIVED: 2/);
  assert.match(ui, /Date\.parse\(right\.updatedAt\) - Date\.parse\(left\.updatedAt\)/);
  assert.doesNotMatch(`${ui}\n${card}`, /ownerId|identityId/);
});

test("Lot 2 UI creates no global route or automatic business side effect", () => {
  const code = [
    "MyDirectoryOverview.tsx", "RepresentationEditor.tsx", "RepresentationCard.tsx", "RepresentationList.tsx",
  ].map((name) => read(`components/directory/${name}`)).join("\n");
  assert.doesNotMatch(code, /\/api\/directory\/(search|global|contacts|requests)/);
  assert.doesNotMatch(code, /prisma\.|ContactRequest|RepresentationContact|CommunicationSession|MatchingRun|notification|invitation/i);
});

test("directory controls have visible labels, accessible feedback and mobile-safe cards", () => {
  const editor = read("components/directory/RepresentationEditor.tsx");
  const overview = read("components/directory/MyDirectoryOverview.tsx");
  const card = read("components/directory/RepresentationCard.tsx");
  assert.match(editor, /<label/);
  assert.match(editor, /role="alert"/);
  assert.match(editor, /firstInput\.current\?\.focus/);
  assert.match(overview, /role="status"/);
  assert.match(overview, /sectionHeading\.current\?\.focus/);
  assert.match(card, /flex flex-wrap/);
  assert.doesNotMatch(card, /<table|overflow-x-auto/);
});
