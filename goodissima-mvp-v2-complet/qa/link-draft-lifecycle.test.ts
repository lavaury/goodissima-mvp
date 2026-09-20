import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canPublishLink,
  canTransitionLinkStatus,
  LINK_STATUS_TRANSITIONS,
} from "../lib/link-lifecycle.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const now = new Date("2026-09-11T12:00:00.000Z");

test("the canonical lifecycle exposes only the authorized transitions", () => {
  assert.deepEqual(LINK_STATUS_TRANSITIONS, {
    DRAFT: ["ACTIVE", "ARCHIVED"],
    ACTIVE: ["DISABLED", "EXPIRED", "ARCHIVED"],
    DISABLED: ["ACTIVE", "ARCHIVED"],
    EXPIRED: ["ARCHIVED"],
    ARCHIVED: [],
  });
  assert.equal(canTransitionLinkStatus("DRAFT", "ACTIVE"), true);
  assert.equal(canTransitionLinkStatus("DRAFT", "DISABLED"), false);
  assert.equal(canTransitionLinkStatus("ARCHIVED", "ACTIVE"), false);
  assert.equal(canTransitionLinkStatus("ACTIVE", "ACTIVE"), false);
});

test("publication accepts drafts and disabled links only when they are not expired", () => {
  assert.equal(canPublishLink({ status: "DRAFT", expiresAt: null }, now), true);
  assert.equal(canPublishLink({ status: "DRAFT", expiresAt: new Date(now.getTime() + 1) }, now), true);
  assert.equal(canPublishLink({ status: "DISABLED", expiresAt: null }, now), true);
  assert.equal(canPublishLink({ status: "DRAFT", expiresAt: now }, now), false);
  assert.equal(canPublishLink({ status: "DRAFT", expiresAt: new Date(now.getTime() - 1) }, now), false);
  assert.equal(canPublishLink({ status: "DISABLED", expiresAt: new Date(now.getTime() - 1) }, now), false);
  for (const status of ["ACTIVE", "EXPIRED", "ARCHIVED"] as const) {
    assert.equal(canPublishLink({ status, expiresAt: null }, now), false);
  }
});

test("Prisma adds DRAFT additively without changing the ACTIVE default", () => {
  const schema = source("prisma/schema.prisma");
  const migration = source("prisma/migrations/20260911120000_add_draft_link_status/migration.sql");
  assert.match(schema, /enum LinkStatus\s*\{[\s\S]*DRAFT[\s\S]*ACTIVE/);
  assert.match(schema, /status\s+LinkStatus\s+@default\(ACTIVE\)/);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'DRAFT'/);
  assert.doesNotMatch(migration, /UPDATE|DELETE|DROP/i);
});

test("owner transitions enforce lifecycle and expiration before persistence", () => {
  const route = source("app/api/links/[linkId]/route.ts");
  assert.match(route, /canTransitionLinkStatus\(link\.status as LinkLifecycleStatus, "ARCHIVED"\)/);
  assert.match(route, /canPublishLink\(\{ status: link\.status as LinkLifecycleStatus, expiresAt: link\.expiresAt \}, new Date\(\)\)/);
  assert.ok(route.indexOf("canPublishLink") < route.indexOf('data: { status: "ACTIVE" }'));
});

test("draft links stay absent from every public diffusion surface", () => {
  const publicPage = source("app/l/[slug]/page.tsx");
  const matching = source("app/api/links/[linkId]/matching/route.ts");
  const card = source("components/LinkCard.tsx");
  const detail = source("app/(connected)/links/[linkId]/page.tsx");
  const actions = source("components/AnnouncementActions.tsx");

  assert.match(publicPage, /status !== "ACTIVE"/);
  assert.match(matching, /status:\s*"ACTIVE"/);
  assert.match(card, /const isDraft = status === "DRAFT"/);
  assert.match(card, /Brouillon — non publié/);
  assert.match(card, /!isDraft \? <div[^>]+dashboard-link-public-url/);
  assert.match(card, /!isDraft \? <><span[^>]+dashboard-link-copy/);
  assert.match(detail, /const isDraft = link\.status === "DRAFT"/);
  assert.match(detail, /Brouillon — non publié\. Aucun lien public, partage ou accès candidat n’est disponible/);
  assert.match(actions, /status !== "DRAFT" \? <a href=\{publicUrl\}/);
});

test("owner workspaces retain drafts and opportunity counts deduplicate legacy drafts", () => {
  const repository = source("lib/governance-workspace-repository.ts");
  const attachments = source("components/SpacesExistingAttachments.tsx");
  const opportunities = source("app/(connected)/opportunities/page.tsx");

  assert.match(repository, /gLink\.findMany/);
  assert.match(repository, /status:\s*true/);
  assert.match(attachments, /linkStatusLabel\(link\.status\)/);
  assert.match(opportunities, /status:\s*"DRAFT"/);
  assert.match(opportunities, /links:\s*\{ none:\s*\{ ownerId: owner\.id, status: "DRAFT" \} \}/);
  assert.match(opportunities, /draftLinkCount \+ historicalDraftCount/);
});
