import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { loadTestModule } from "./helpers/load-test-module.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the modern public opportunity offers one anonymous secure exchange CTA", () => {
  const component = source("components/PublicOpportunitySecureExchange.tsx");
  for (const text of [
    "Cette opportunité vous intéresse ?",
    "Commencez un échange sécurisé avec son auteur.",
    "Votre message",
    "(facultatif)",
    "Vous pouvez ajouter un premier message.",
    "Commencer l’échange sécurisé",
  ]) assert.ok(component.includes(text), text);
  for (const forbidden of ["Nom complet", "Téléphone", "Pièce d’identité", "Postuler", "Candidater", "Répondre à cette annonce"]) {
    assert.ok(!component.includes(forbidden), forbidden);
  }
  assert.match(component, /className="mt-4 min-h-12 w-full[^\"]*sm:w-auto"/);
});

test("the CTA creates a case once and opens only the returned secure token", () => {
  const component = source("components/PublicOpportunitySecureExchange.tsx");
  assert.match(component, /if \(pending\) return/);
  assert.match(component, /disabled=\{pending\}/);
  assert.match(component, /fetch\("\/api\/cases"/);
  assert.match(component, /JSON\.stringify\(\{ gLinkId, message: message\.trim\(\) \}\)/);
  assert.match(component, /router\.push\(`\/secure\/\$\{encodeURIComponent\(token\)\}`\)/);
  for (const injected of ["ownerId", "workspaceId", "templateId", "matchingEnabled", "governanceStatus", "relationStatus"]) {
    assert.ok(!component.includes(injected), injected);
  }
});

test("the server remains authoritative and derives the dossier ownership and lifecycle", () => {
  const route = source("app/api/cases/route.ts");
  assert.match(route, /if \(!canSubmitToGLink\(gLink, submissionNow\)\)/);
  assert.match(route, /ownerId: gLink\.ownerId/);
  assert.match(route, /gLinkId: gLink\.id/);
  assert.match(route, /candidateAccessToken: createCandidateAccessToken\(\)/);
  assert.match(route, /status: RelationStatus\.NEW/);
  assert.match(route, /return withCandidateCookie\(relationCase\.candidateAccessToken/);
  assert.doesNotMatch(route, /MatchingRun|MatchingResult/);
});

test("private aliases stay filtered from owner-facing identity", () => {
  const identity = source("lib/candidate-identity.ts");
  assert.match(identity, /syntheticEmailPattern/);
  assert.match(identity, /Candidat non identifié/);
  assert.match(identity, /Contact non renseigné/);
});

test("the real cases route creates an anonymous dossier for a template-less opportunity", async () => {
  const file = "app/api/cases/route.ts";
  const imports = Object.fromEntries(ts.preProcessFile(readFileSync(file, "utf8")).importedFiles.map((item) => [item.fileName, {}]));
  const writes: Array<{ model: string; data: Record<string, unknown> }> = [];
  const tx = {
    goodissimaIdentity: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ model: "identity", data }); return { id: "identity" }; } },
    relationCase: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ model: "case", data }); return { id: "case", candidateAccessToken: data.candidateAccessToken, candidateName: data.candidateName, candidateEmailNotificationsEnabled: false, owner: { email: "owner@example.test", notificationPreferences: {} }, gLink: { title: "Opportunity" } }; } },
    trustPolicy: { create: async () => { throw new Error("no policy expected"); } },
  };
  const prisma = {
    gLink: { findUnique: async () => ({ id: "opportunity", ownerId: "owner", templateId: null, status: "ACTIVE", expiresAt: null, admissionMode: "OPEN", rules: { creationSource: "opportunity", opportunity: { schemaVersion: 1, type: "NEED", criteria: { subject: "baby-sitter" }, matchingEnabled: false } }, owner: { email: "owner@example.test", notificationPreferences: {} } }) },
    relationCase: { findMany: async () => [] },
    message: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ model: "message", data }); return { id: "message" }; } },
    document: { create: async () => { throw new Error("no document expected"); } },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  };
  const json = (body: unknown, init?: ResponseInit) => {
    const response = Response.json(body, init) as Response & { cookies: { set: () => void } };
    response.cookies = { set() {} };
    return response;
  };
  const route = loadTestModule<any>(file, {
    ...imports,
    "next/server": { NextResponse: { json } },
    "@prisma/client": { Prisma: {}, RelationStatus: { NEW: "NEW" } },
    "@/lib/prisma": { prisma },
    "@/lib/secure-link-submission": { canSubmitToGLink: (link: { status: string }) => link.status === "ACTIVE" },
    "@/lib/simple-link-fields": { isSimpleLink: () => false, isSimpleLinkRelationalEmailField: () => false },
    "@/lib/candidate-form-safety": { deriveCandidateSubmissionFields: (_answers: unknown, values: unknown) => values, buildCandidateMessageFallback: () => "Nouvel échange sécurisé", findMissingRequiredCandidateField: () => null, formatMissingRequiredFieldError: () => "", toCandidateFormField: (field: unknown) => field },
    "@/lib/forms": { buildHumanReadableFormMessage: () => "", createFormSubmission: async () => {}, getFormFields: async () => [] },
    "@/lib/relation-templates": { getRelationTemplateForLink: async () => null },
    "@/lib/trust-policy": { resolveAdmissionTrustPolicyForLink: async () => ({ policy: null, source: null }), evaluateRelationAdmissionPolicyV1: () => ({ allowed: true, reasons: [], missingRequirements: [] }) },
    "@/lib/secure-link-admission": { canSubmitToSecureLink: () => true },
    "@/lib/trust-credentials": { issueCandidateCreatedCredentialInTransaction: async () => ({ id: "credential" }) },
    "@/lib/candidate-access": { CANDIDATE_ACCESS_TTL_DAYS: 30, createCandidateAccessExpiresAt: () => new Date("2026-10-13T00:00:00Z"), createCandidateAccessToken: () => "secure-token" },
    "@/lib/secure-trace": { secureTokenHash: async () => "hash", secureTrace: () => {} },
    "@/lib/events": { createRelationEvent: async () => {} },
    "@/lib/audit": { auditLog: async () => {} },
    "@/lib/privacy": { isNotificationEnabled: () => false, logNotificationSkipped: () => {} },
    "@/lib/email": { sendNewDocumentEmail: async () => {}, sendNewMessageEmail: async () => {}, sendNewRelationCaseEmail: async () => {} },
    "@/lib/trust-admission-tokens": { markTrustAdmissionTokenUsed: async () => {}, resolveTrustAdmissionToken: async () => ({ resolved: false, reasons: [] }) },
  }, { console: { warn() {}, error() {}, info() {} } });

  const response = await route.POST({ json: async () => ({ gLinkId: "opportunity", message: "Bonjour" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { candidateAccessToken: "secure-token" });
  const dossier = writes.find((write) => write.model === "case")!.data;
  assert.equal(dossier.gLinkId, "opportunity");
  assert.equal(dossier.ownerId, "owner");
  assert.equal(dossier.templateId, undefined);
  assert.equal(dossier.candidateName, "");
  assert.equal(dossier.candidateEmail, "");
  assert.equal(dossier.status, "NEW");
  assert.ok(!("workspaceId" in dossier));
  assert.deepEqual(writes.find((write) => write.model === "message")!.data, { caseId: "case", senderType: "CANDIDATE", senderEmail: "", body: "Bonjour" });
});
