import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/(connected)/links/[linkId]/page.tsx");
const panel = read("components/RelationRequestsPanel.tsx");
const relations = read("app/(connected)/relations/page.tsx");
const runtime = read("lib/public-relation-request-notification.ts");
const email = read("lib/email.ts");

test("link responses unify modern requests and legacy cases without double counting", () => {
  assert.match(page, /requestCaseIds/); assert.match(page, /legacyCases = link\.cases\.filter/); assert.match(page, /responseCount = relationRequests\.length \+ legacyCases\.length/);
  for (const status of ["PENDING", "ACCEPTED", "DECLINED"]) assert.match(page, new RegExp(status));
  assert.match(panel, /relation-request-\$\{request\.id\}/); assert.match(panel, /Ouvrir le dossier/); assert.match(panel, /Motif du refus/);
});

test("decisions happen inline and relations is only a contextual inbox", () => {
  assert.match(panel, /Accepter la demande/); assert.match(panel, /Confirmer le refus/); assert.match(panel, /minLength=\{3\}/); assert.match(panel, /maxLength=\{500\}/);
  assert.match(panel, /JSON\.stringify\(decision === "decline" \? \{ reason: reason\.trim\(\), gLinkId \} : \{ gLinkId \}\)/);
  assert.match(relations, /Examiner dans le Lien/); assert.match(relations, /\/links\/\$\{request\.gLinkId\}#relation-request-/); assert.doesNotMatch(relations, /RelationRequestsPanel/);
});

test("notification respects consent, excludes technical addresses and runs after decision", () => {
  assert.match(runtime, /candidateEmailNotificationsEnabled/); assert.match(runtime, /private-\.\*@goodissima/); assert.match(runtime, /SKIPPED_NO_CONSENT/); assert.match(runtime, /RELATION_REQUEST_DECISION_NOTIFICATION_/);
  assert.match(email, /sendRelationRequestAcceptedEmail/); assert.match(email, /sendRelationRequestDeclinedEmail/); assert.match(email, /Motif communiqué par le destinataire/);
  assert.doesNotMatch(runtime.match(/metadata: \{ requestId:[\s\S]*?\}\s*\}/)?.[0] ?? "", /candidateAccessToken|declineReason|candidateEmail/);
});

test("owner sees submitted content without an email identity or raw storage key", () => {
  assert.match(panel, /Notification e-mail autorisée/); assert.match(panel, /Aucun canal e-mail autorisé/); assert.match(panel, /openAttachment/); assert.doesNotMatch(panel, /candidateEmail|storageKey/);
  assert.match(page, /fieldLabels/); assert.match(page, /Réponse structurée/);
});
