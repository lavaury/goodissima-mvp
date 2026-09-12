import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("simple-link owner page focuses on sharing, access, responses and form", () => {
  const page = source("app/(connected)/links/[linkId]/page.tsx");
  for (const copy of ["Lien simple", "Partage", "Accès", "Réponses", "Détail du formulaire", "Mes espaces"]) assert.ok(page.includes(copy));
  assert.match(page, /`\/l\/\$\{link\.slug\}`/);
  assert.doesNotMatch(page, /DashboardBackLink|ProductLifecycle|ProductContextBanner|AnnouncementActions/);
  assert.match(page, /Fonctions historiques/);
});

test("simple-link lifecycle uses accessible confirmations", () => {
  const controls = source("components/SimpleLinkOwnerControls.tsx");
  const api = source("app/api/links/[linkId]/route.ts");
  for (const copy of ["Suspendre", "Réactiver", "Archiver", 'role="dialog"', 'aria-modal="true"']) assert.ok(controls.includes(copy));
  assert.doesNotMatch(controls, /window\.confirm/);
  assert.match(api, /action === "disable"/);
});
