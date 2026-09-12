import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("an announcement without a secure link keeps the explicit creation flow", () => {
  const previewActions = source("components/OpportunityPreviewActions.tsx");
  assert.match(previewActions, /Créer un lien sécurisé/);
  assert.match(previewActions, /withCreationWorkspace\(`\/links\/new\?templateId=\$\{encodeURIComponent\(relationTemplateId\)\}`/);
  assert.match(previewActions, /workspaceId/);
});

test("an existing simple link exposes its canonical sharing surface", () => {
  const managementPage = source("app/(connected)/links/[linkId]/page.tsx");
  assert.match(managementPage, /const publicPath = `\/l\/\$\{link\.slug\}`/);
  assert.match(managementPage, /<SimpleLinkOwnerControls linkId={link\.id} publicUrl={publicUrl}/);
  assert.match(managementPage, /data-boussole-id="simple-link-sharing"/);
  assert.match(managementPage, />Partage</);
  assert.doesNotMatch(managementPage, /import \{ AnnouncementActions \}|DashboardBackLink|ProductLifecycle/);
});

test("management and mutation routes remain owner-scoped", () => {
  const managementPage = source("app/(connected)/links/[linkId]/page.tsx");
  const mutationRoute = source("app/api/links/[linkId]/route.ts");
  assert.match(managementPage, /where: \{ id: params\.linkId, ownerId: owner\.id \}/);
  assert.match(managementPage, /if \(!link\) notFound\(\)/);
  assert.match(mutationRoute, /where: \{ id: params\.linkId, ownerId: owner\.id \}/);
});

test("opening an existing legacy announcement link cannot create duplicates", () => {
  const actions = source("components/AnnouncementActions.tsx");
  assert.doesNotMatch(actions, /fetch\([^\n]+method:\s*"POST"/s);
  assert.doesNotMatch(actions, /prisma|relationCase|conversation|message|notification|dossier/i);
  assert.doesNotMatch(actions, /window\.location|router\.push/);
});
