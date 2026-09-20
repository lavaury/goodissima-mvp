import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = source("components/RelationActionsPanel.tsx");
const tabs = source("components/DossierWorkspaceTabs.tsx");
const ai = source("components/AIWorkspace.tsx");
const route = source("app/api/cases/[caseId]/actions/route.ts");

test("separates pending and completed requests using the existing status", () => {
  assert.match(panel, /status !== "COMPLETED"/);
  assert.match(panel, /status === "COMPLETED"/);
  assert.match(panel, />En cours</);
  assert.match(panel, /Terminées \(\{completedActions\.length\}\)/);
  assert.match(panel, /Aucune demande en cours\./);
});

test("keeps the creation form out of the initial surface", () => {
  assert.match(panel, /\+ Nouvelle demande/);
  assert.match(panel, /createOpen && editable \? createPortal/);
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /event\.key === "Escape"/);
  assert.match(panel, /event\.key === "Tab"/);
  assert.match(panel, /min-h-11/);
});

test("prepares identification in the same human-confirmed request flow", () => {
  assert.match(panel, /prepareIdentityRequest/);
  assert.match(panel, /candidateIdentityRequestTitle/);
  assert.match(ai, /goodissima:prepare-relation-request/);
  assert.match(tabs, /selectTab\("requests"\)/);
  assert.equal((panel.match(/fetch\(`\/api\/cases\/\$\{caseId\}\/actions`/g) ?? []).length, 1);
  assert.doesNotMatch(ai, /fetch\(/);
});

test("compact request actions use one menu for button and local right click", () => {
  assert.match(panel, /Actions pour \$\{action\.title\}/);
  assert.match(panel, /onContextMenu/);
  assert.match(panel, /role="menu"/);
  assert.match(panel, /role="menuitem"/);
  assert.match(panel, /body: JSON\.stringify\(\{ status: "COMPLETED", candidateAccessToken \}\)/);
});

test("server ownership, governance, Trust Policy, events, notifications and embeddings remain intact", () => {
  for (const contract of ["ownerId: owner.id", "canWriteInRelation", "evaluateTrustPolicyV1", 'action: "WRITE"', "ACTION_CREATED", "enqueueEmbeddingJob", "sendNewRelationActionEmail"]) assert.ok(route.includes(contract), `missing ${contract}`);
});
