import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("an announcement without a secure link keeps the explicit creation flow", () => {
  const previewActions = source("components/OpportunityPreviewActions.tsx");

  assert.match(previewActions, /Créer un lien sécurisé/);
  assert.match(previewActions, /href={`\/links\/new\?templateId=/);
});

test("an existing secure link is opened instead of being created or copied again", () => {
  const actions = source("components/AnnouncementActions.tsx");
  const managementPage = source("app/links/[linkId]/page.tsx");

  assert.doesNotMatch(actions, /Créer un lien sécurisé/);
  assert.match(actions, /<a href={publicUrl}/);
  assert.match(actions, /Voir l'annonce publique/);
  assert.doesNotMatch(actions, /navigator\.clipboard|copySecureLink|method:\s*"POST"/);
  assert.match(managementPage, /const publicPath = `\/l\/\$\{link\.slug\}`/);
  assert.match(managementPage, /<AnnouncementActions linkId={link\.id} publicUrl={publicUrl}/);
  assert.match(managementPage, /Lien public candidat/);
});

test("management and mutation routes remain owner-scoped", () => {
  const managementPage = source("app/links/[linkId]/page.tsx");
  const mutationRoute = source("app/api/links/[linkId]/route.ts");

  assert.match(managementPage, /where: \{ id: params\.linkId, ownerId: owner\.id \}/);
  assert.match(managementPage, /if \(!link\) notFound\(\)/);
  assert.match(mutationRoute, /where: \{ id: params\.linkId, ownerId: owner\.id \}/);
});

test("opening an existing link cannot create duplicates or mutate business resources", () => {
  const actions = source("components/AnnouncementActions.tsx");

  assert.doesNotMatch(actions, /fetch\([^\n]+method:\s*"POST"/s);
  assert.doesNotMatch(actions, /prisma|relationCase|conversation|message|notification|dossier/i);
  assert.doesNotMatch(actions, /window\.location|router\.push/);
});
