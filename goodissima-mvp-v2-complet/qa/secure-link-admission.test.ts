import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_SECURE_LINK_ADMISSION_MODE,
  canSubmitToSecureLink,
  parseSecureLinkAdmissionMode,
  SECURE_LINK_ADMISSION_LABELS,
} from "../lib/secure-link-admission.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("defaults new and legacy secure links to open admission", () => {
  assert.equal(DEFAULT_SECURE_LINK_ADMISSION_MODE, "OPEN");
  assert.equal(parseSecureLinkAdmissionMode(undefined), "OPEN");
  assert.equal(parseSecureLinkAdmissionMode("UNKNOWN"), "OPEN");
  assert.equal(SECURE_LINK_ADMISSION_LABELS.OPEN, "Ouverte à tous");
});

test("shows the Admission block consistently on every secure link card", () => {
  const card = source("components/LinkCard.tsx");
  const dashboard = source("app/dashboard/page.tsx");
  const linkPage = source("app/links/[linkId]/page.tsx");
  const opportunities = source("app/opportunities/page.tsx");

  assert.match(card, /<LinkAdmissionPanel/);
  assert.doesNotMatch(card, /isTrustAdmissionPilot|showAdmissionPanel/);
  assert.match(linkPage, /<LinkAdmissionPanel linkId=\{link\.id\} initialMode=\{link\.admissionMode\}/);
  assert.match(opportunities, /admissionMode:\s*item\.admissionMode/);
  assert.doesNotMatch(dashboard, /TRUST_ADMISSION_PILOT_GLINK_IDS|TRUST_ADMISSION_VERIFIED_LINK_UI_ENABLED/);
});

test("persists admission mode directly on GLink for new and existing links", () => {
  const schema = source("prisma/schema.prisma");
  const createRoute = source("app/api/links/route.ts");
  const updateRoute = source("app/api/links/[linkId]/admission/route.ts");
  const migration = source("prisma/migrations/20260618170000_add_glink_admission_mode/migration.sql");

  assert.match(schema, /admissionMode\s+LinkAdmissionMode\s+@default\(OPEN\)/);
  assert.match(createRoute, /admissionMode:\s*parseSecureLinkAdmissionMode\(body\.admissionMode\)/);
  assert.match(updateRoute, /data:\s*\{\s*admissionMode:\s*mode\s*\}/);
  assert.match(migration, /DEFAULT 'OPEN'/);
  assert.match(migration, /credential_type\.code = 'VERIFIED_IDENTITY'/);
});

test("enforces verified-only while allowing anonymous open submissions", () => {
  assert.equal(canSubmitToSecureLink({ mode: "OPEN", hasVerifiedIdentity: false }), true);
  assert.equal(canSubmitToSecureLink({ mode: "VERIFIED_ONLY", hasVerifiedIdentity: false }), false);
  assert.equal(canSubmitToSecureLink({ mode: "VERIFIED_ONLY", hasVerifiedIdentity: true }), true);

  const casesRoute = source("app/api/cases/route.ts");
  assert.match(casesRoute, /gLink\.admissionMode === "VERIFIED_ONLY"/);
  assert.match(casesRoute, /code:\s*"TRUST_ADMISSION_BLOCKED"/);
  assert.match(casesRoute, /status:\s*"VERIFIED"/);
  assert.match(casesRoute, /credentialType:\s*\{\s*code:\s*"VERIFIED_IDENTITY"\s*\}/);
});

test("guides unverified candidates without making identity mandatory in open mode", () => {
  const candidateForm = source("app/l/[slug]/candidate-form.tsx");
  const creationForm = source("app/links/new/NewLinkForm.tsx");

  assert.match(candidateForm, /Vérifier mon identité/);
  assert.match(candidateForm, /Vous pouvez répondre sans fournir votre identité/);
  assert.match(creationForm, /admissionMode:\s*"OPEN"/);
  assert.match(creationForm, /requireEmail:\s*false/);
  assert.match(creationForm, /Le mode ouvert autorise les réponses anonymes/);
});
