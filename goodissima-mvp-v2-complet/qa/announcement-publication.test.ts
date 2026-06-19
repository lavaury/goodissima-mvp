import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ANNOUNCEMENT_PUBLICATION_SUCCESS,
  applyAnnouncementPublication,
  announcementPublicationState,
} from "../lib/announcement-publication.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("keeps an unpublished announcement in draft state", () => {
  assert.deepEqual(announcementPublicationState(), {
    status: "DRAFT",
    publishedAt: null,
    publicationStatus: "Brouillon · Non publiée",
  });
});

test("applies the successful announcement publication lifecycle", () => {
  const publishedAt = "2026-06-15T10:30:00.000Z";
  assert.deepEqual(applyAnnouncementPublication({
    publishedObject: "ANNOUNCEMENT",
    status: "PUBLISHED",
    publishedAt,
    version: 3,
  }), {
    status: "PUBLISHED",
    publishedAt,
    publicationStatus: "Publiée",
  });
  assert.equal(ANNOUNCEMENT_PUBLICATION_SUCCESS, "Annonce publiée avec succès.");
});

test("publish action persists a published version and invalidates cached views", () => {
  const route = source("app/api/templates/[templateId]/publish/route.ts");
  assert.match(route, /checkCandidatePublicationSafety/);
  assert.match(route, /CANDIDATE_FORM_SAFETY_BLOCKED/);
  assert.match(route, /candidateFormSafety\.publishable/);
  assert.match(route, /templateVersion\.create/);
  assert.match(route, /isPublished:\s*true/);
  assert.match(route, /status:\s*"PUBLISHED"/);
  assert.match(route, /publishedObject:\s*"ANNOUNCEMENT"/);
  assert.match(route, /revalidatePath\(`\/templates\/\$\{params\.templateId\}`\)/);
  assert.match(route, /revalidatePath\("\/opportunities"\)/);
});

test("frontend refreshes, updates status and exposes success feedback", () => {
  const button = source("components/PublishTemplateButton.tsx");
  const card = source("components/OpportunityPreviewCard.tsx");
  const actions = source("components/OpportunityPreviewActions.tsx");
  assert.match(button, /router\.refresh\(\)/);
  assert.match(button, /onPublished\?\.\(result\)/);
  assert.match(button, /Annonce publiée/);
  assert.match(card, /ANNOUNCEMENT_PUBLICATION_SUCCESS/);
  assert.match(card, /publication\.publicationStatus/);
  assert.match(card, /publication\.publishedAt/);
  assert.match(card, /publication\.status === "PUBLISHED"/);
  assert.match(actions, /isPublished \? <Link href=\{`\/links\/new\?templateId=\$\{encodeURIComponent\(relationTemplateId\)\}`\}/);
  assert.match(actions, /Créer un lien sécurisé/);
});

test("template page derives publication UX from the displayed persisted version", () => {
  const page = source("app/templates/[templateId]/page.tsx");
  assert.match(page, /isPublished:\s*Boolean\(lastVersion\?\.isPublished\)/);
  assert.match(page, /Date de publication:/);
  assert.match(page, /activeVersion\.createdAt/);
});
