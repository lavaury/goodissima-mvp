import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildFeedbackStatusUpdate,
  buildFeedbackWhere,
  buildProductFeedbackCsv,
  canAccessFeedbackAdmin,
  normalizeFeedbackStatus,
  normalizeFeedbackType,
} from "../lib/product-feedback.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("creates product feedback in database with limited production metadata", () => {
  const route = source("app/api/feedback/route.ts");

  assert.match(route, /prisma\.productFeedback\.create/);
  assert.match(route, /req\.formData\(\)/);
  assert.match(route, /screenshots/);
  assert.match(route, /maxFeedbackScreenshots/);
  assert.match(route, /maxFeedbackScreenshotSizeBytes/);
  assert.match(route, /productFeedbackAttachment\.createMany/);
  assert.match(route, /userAgent/);
  assert.match(route, /browserLanguage/);
  assert.match(route, /viewport/);
  assert.match(route, /environment/);
  assert.match(route, /return NextResponse\.json\(\{ ok: true \}\)/);
  assert.doesNotMatch(route, /return NextResponse\.json\(\{ ok: true, id:/);
});

test("normalizes feedback creation inputs", () => {
  assert.equal(normalizeFeedbackType("UX"), "UX");
  assert.equal(normalizeFeedbackType("Unknown"), "Autre");
  assert.equal(normalizeFeedbackStatus("RESOLVED"), "RESOLVED");
  assert.equal(normalizeFeedbackStatus("BAD"), "NEW");
});

test("builds type, status and search filters", () => {
  assert.deepEqual(buildFeedbackWhere({ type: "Bug", status: "NEW", search: "paiement" }), {
    type: "Bug",
    status: "NEW",
    OR: [
      { message: { contains: "paiement", mode: "insensitive" } },
      { page: { contains: "paiement", mode: "insensitive" } },
      { adminNotes: { contains: "paiement", mode: "insensitive" } },
    ],
  });
  assert.deepEqual(buildFeedbackWhere({ type: "Bad", status: "Bad", search: "" }), {});
});

test("updates status and resolved timestamp consistently", () => {
  const resolved = buildFeedbackStatusUpdate("RESOLVED", "Traité dans Linear");
  assert.equal(resolved.status, "RESOLVED");
  assert.equal(resolved.adminNotes, "Traité dans Linear");
  assert.ok(resolved.resolvedAt instanceof Date);

  const reopened = buildFeedbackStatusUpdate("IN_PROGRESS", null);
  assert.equal(reopened.status, "IN_PROGRESS");
  assert.equal(reopened.resolvedAt, null);
});

test("exports feedback as escaped CSV", () => {
  const csv = buildProductFeedbackCsv([
    {
      id: "fb_1",
      type: "Bug",
      status: "NEW",
      message: 'Le bouton "Valider" ne répond pas',
      page: "/cases/123",
      role: "OWNER",
      userId: "user_1",
      caseId: "case_1",
      templateId: null,
      environment: "production",
      browserInfo: { language: "fr-FR", viewport: { width: 1280, height: 720 } },
      adminNotes: null,
      createdAt: new Date("2026-06-17T10:00:00.000Z"),
      updatedAt: new Date("2026-06-17T10:00:00.000Z"),
      resolvedAt: null,
    },
  ]);

  assert.match(csv, /^id,type,status,message/);
  assert.match(csv, /attachmentsCount/);
  assert.match(csv, /"Le bouton ""Valider"" ne répond pas"/);
  assert.match(csv, /"production"/);
  assert.match(csv, /"2026-06-17T10:00:00.000Z"/);
});

test("restricts feedback review to product administration roles", () => {
  assert.equal(canAccessFeedbackAdmin("ADMIN"), true);
  assert.equal(canAccessFeedbackAdmin("SUPER_ADMIN"), true);
  assert.equal(canAccessFeedbackAdmin("PRODUCT_OWNER"), true);
  assert.equal(canAccessFeedbackAdmin("OWNER"), false);
  assert.equal(canAccessFeedbackAdmin(null), false);

  assert.match(source("app/administration/feedback/page.tsx"), /canAccessFeedbackAdmin\(owner\.role\)/);
  assert.match(source("app/api/admin/feedback/export/route.ts"), /canAccessFeedbackAdmin\(owner\.role\)/);
  assert.match(source("app/api/admin/feedback/[feedbackId]/route.ts"), /canAccessFeedbackAdmin\(owner\.role\)/);
  assert.match(source("app/api/admin/feedback/attachments/[attachmentId]/file/route.ts"), /canAccessFeedbackAdmin\(owner\.role\)/);
});

test("adds Administration feedback review UI", () => {
  const page = source("app/administration/feedback/page.tsx");
  const administration = source("app/administration/page.tsx");
  assert.match(page, /Revue des retours produit/);
  assert.match(page, /Tous les types/);
  assert.match(page, /Tous les statuts/);
  assert.match(page, /Notes administrateur/);
  assert.match(page, /Exporter CSV/);
  assert.match(page, /Captures d'écran/);
  assert.match(page, /Télécharger/);
  assert.match(page, /<img/);
  assert.match(administration, /canAccessFeedbackAdmin\(owner\.role\)/);
  assert.match(administration, /showFeedbackAdmin \?/);
  assert.match(administration, /\/administration\/feedback/);
  assert.match(administration, /Accès réservé/);
  assert.match(administration, /aria-disabled="true"/);
});

test("adds opt-in screenshot and page-context controls to the feedback form", () => {
  const button = source("components/FeedbackButton.tsx");
  assert.match(button, /Ajouter une capture d'écran/);
  assert.match(button, /Joindre la page actuelle/);
  assert.match(button, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(button, /maxScreenshots = 5/);
  assert.match(button, /maxScreenshotSizeBytes = 10 \* 1024 \* 1024/);
  assert.match(button, /new FormData\(\)/);
  assert.doesNotMatch(button, /getDisplayMedia|mediaDevices|captureStream/);
});

test("adds feedback attachment persistence model", () => {
  const schema = source("prisma/schema.prisma");
  assert.match(schema, /model ProductFeedbackAttachment/);
  assert.match(schema, /feedbackId String/);
  assert.match(schema, /annotation Json\?/);
  assert.match(schema, /attachments ProductFeedbackAttachment\[\]/);
});
