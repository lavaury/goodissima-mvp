import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  announcementBelongsToView,
  announcementListView,
  announcementStatusLabel,
} from "../lib/announcement-archive.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("archive action targets the announcement secure link and persists ARCHIVED", () => {
  const actions = source("components/AnnouncementActions.tsx");
  const ownerCard = source("components/LinkCard.tsx");
  const route = source("app/api/links/[linkId]/route.ts");

  assert.match(actions, /patch\("archive"\)/);
  assert.match(ownerCard, /Archiver l'annonce/);
  assert.match(ownerCard, /action: "archive"/);
  assert.match(ownerCard, /Annonce archivée/);
  assert.match(ownerCard, /router\.push\("\/opportunities\?view=archived"\)/);
  assert.doesNotMatch(ownerCard, /debugMode[^\n]+Archiver l'annonce/);
  assert.match(actions, /fetch\(`\/api\/links\/\$\{linkId\}`/);
  assert.match(actions, /method:\s*"PATCH"/);
  assert.match(route, /action === "archive"/);
  assert.match(route, /prisma\.gLink\.update/);
  assert.match(route, /status:\s*"ARCHIVED"/);
  assert.doesNotMatch(route, /archivedAt/);
  assert.match(route, /archived:\s*true/);
  assert.match(route, /deleted:\s*false/);
  assert.doesNotMatch(route, /\.delete\(/);
});

test("archived status is distinct from suspension and has French-first copy", () => {
  assert.equal(announcementStatusLabel("ARCHIVED"), "Archivée");
  assert.equal(announcementStatusLabel("DISABLED"), "Suspendue");

  const schema = source("prisma/schema.prisma");
  const migration = source("prisma/migrations/20260618143000_add_archived_link_status/migration.sql");
  assert.match(schema, /enum LinkStatus[\s\S]+ARCHIVED/);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'ARCHIVED'/);
});

test("frontend updates immediately and refreshes server views after archive", () => {
  const actions = source("components/AnnouncementActions.tsx");
  const route = source("app/api/links/[linkId]/route.ts");

  assert.match(actions, /setStatus\(result\.status/);
  assert.match(actions, /announcementStatusLabel\(status\)/);
  assert.match(actions, /router\.refresh\(\)/);
  assert.match(route, /revalidatePath\(`\/links\/\$\{link\.id\}`\)/);
  assert.match(route, /revalidatePath\("\/opportunities", "page"\)/);
  assert.match(route, /revalidatePath\("\/dashboard"\)/);
});

test("active and archived announcement views are mutually exclusive", () => {
  assert.equal(announcementListView(undefined), "active");
  assert.equal(announcementListView("archived"), "archived");
  assert.equal(announcementBelongsToView("ARCHIVED", "active"), false);
  assert.equal(announcementBelongsToView("ARCHIVED", "archived"), true);
  assert.equal(announcementBelongsToView("ACTIVE", "active"), true);
  assert.equal(announcementBelongsToView("DISABLED", "active"), true);

  const opportunities = source("app/opportunities/page.tsx");
  const dashboard = source("app/dashboard/page.tsx");
  const dashboardFilters = source("components/DashboardLinkFilters.tsx");
  assert.match(opportunities, /view === "archived" \? "ARCHIVED" : \{ not: "ARCHIVED" \}/);
  assert.match(opportunities, /\/opportunities\?view=archived/);
  assert.match(opportunities, /Les annonces archivées resteront disponibles ici/);
  assert.match(opportunities, /status:\s*"ARCHIVED"/);
  assert.match(opportunities, /archivedJourneys/);
  assert.match(opportunities, /Parcours d'annonce archivé/);
  assert.match(opportunities, /totalArchivedCount/);
  assert.match(dashboard, /where:\s*\{ ownerId: owner\.id \}/);
  assert.match(dashboardFilters, /item\.status === "ARCHIVED"/);
  assert.match(dashboardFilters, /item\.status !== "ARCHIVED"/);
  assert.match(dashboardFilters, /Aucune annonce archivée\./);
});

test("archive handling does not touch templates, relations, safety, anonymity or trust", () => {
  const route = source("app/api/links/[linkId]/route.ts");

  assert.doesNotMatch(route, /relationTemplate\.(update|delete)/);
  assert.doesNotMatch(route, /relationCase\.(update|delete)/);
  assert.doesNotMatch(route, /candidate-form-safety|candidateName|candidateEmail/);
  assert.doesNotMatch(route, /trustPolicy|credential|identity/);
});
