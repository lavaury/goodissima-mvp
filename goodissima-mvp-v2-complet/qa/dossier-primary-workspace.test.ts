import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workspace = source("components/RelationCaseWorkspace.tsx");

test("renders a minimal business header without the legacy dashboard return", () => {
  assert.match(workspace, /Dossier avec \{candidateIdentityState\.displayName\}/);
  assert.match(workspace, /candidateIdentityState\.status/);
  assert.match(workspace, /Relation \{getRelationGovernanceStatusLabel/);
  assert.match(workspace, /Dossier \{item\.status/);
  assert.match(workspace, /item\.priority !== "NORMAL"/);
  assert.doesNotMatch(workspace, /DashboardBackLink|Retour au Dashboard/);
});

test("uses the real GLink as the concise origin", () => {
  assert.match(workspace, /Issu de : <strong>\{item\.gLink\.title\}<\/strong>/);
  assert.match(workspace, /href=\{`\/links\/\$\{item\.gLink\.id\}`\}/);
  assert.doesNotMatch(workspace, /ProductLifecycle|ProductContextBanner|ProductObjectDefinition/);
});

test("provides four accessible primary dossier destinations", () => {
  for (const target of ["#case-conversation", "#case-documents", "#case-requests", "#case-details"]) {
    assert.ok(workspace.includes(`href: "${target}"`), `missing primary destination ${target}`);
  }
  assert.match(workspace, /aria-label="Espaces du dossier"/);
  assert.match(workspace, /min-h-11/);
  assert.match(workspace, /grid-cols-2[\s\S]*sm:flex/);
});

test("keeps the existing business components reachable in focused surfaces", () => {
  for (const component of ["ChatBox", "DocumentList", "DocumentUpload", "RelationActionsPanel", "RelationGovernanceControls", "CandidateAccessControls", "MatchingOptInPanel", "AIWorkspace", "RelationLiveKitMediaRoom"]) {
    assert.match(workspace, new RegExp(`<${component}`), `missing retained component ${component}`);
  }
  assert.match(workspace, /id="case-documents"/);
  assert.match(workspace, /id="case-requests"/);
  assert.match(workspace, /id="case-details"/);
});

test("keeps Boussole targets on real dossier objects", () => {
  for (const target of ["case-relational-overview", "case-relational-navigation", "case-conversation", "case-documents", "case-communication-history", "candidate-access-controls-section"]) {
    assert.ok(workspace.includes(target), `missing Boussole target ${target}`);
  }
});
