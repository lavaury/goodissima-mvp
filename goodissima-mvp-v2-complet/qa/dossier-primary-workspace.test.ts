import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workspace = source("components/RelationCaseWorkspace.tsx");
const tabs = source("components/DossierWorkspaceTabs.tsx");

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
  for (const tab of ["conversation", "documents", "requests", "details"]) {
    assert.ok(tabs.includes(`id: "${tab}"`), `missing primary tab ${tab}`);
  }
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /role="tab"/);
  assert.match(tabs, /aria-selected/);
  assert.match(tabs, /aria-controls/);
  assert.match(tabs, /min-h-11/);
  assert.match(tabs, /ArrowRight|ArrowLeft/);
});

test("keeps the existing business components reachable in focused surfaces", () => {
  for (const component of ["ChatBox", "DocumentList", "DocumentUpload", "RelationActionsPanel", "RelationGovernanceBadge", "CandidateAccessControls", "MatchingOptInPanel", "AIWorkspace", "DossierCommunicationLauncher"]) {
    assert.match(workspace, new RegExp(`<${component}`), `missing retained component ${component}`);
  }
  for (const tab of ["conversation", "documents", "requests", "details"]) {
    assert.match(workspace, new RegExp(`id="dossier-panel-${tab}"[\\s\\S]{0,100}role="tabpanel"`));
  }
  assert.match(tabs, /useState<DossierWorkspaceTab>\("conversation"\)/);
  assert.match(tabs, /panel\.hidden = panel\.dataset\.dossierTabContent !== tab/);
});

test("keeps Boussole targets on real dossier objects", () => {
  for (const target of ["case-relational-overview", "case-conversation", "case-documents", "case-communication-history", "candidate-access-controls-section"]) {
    assert.ok(workspace.includes(target), `missing Boussole target ${target}`);
  }
  assert.match(tabs, /case-relational-navigation/);
});

test("keeps secondary capabilities exclusively in the details workspace", () => {
  assert.match(workspace, /data-dossier-tab-content="details"[\s\S]*Workspace du dossier/);
  assert.match(workspace, /data-dossier-tab-content="conversation"[\s\S]*case-communication-history/);
  assert.match(workspace, /data-dossier-tab-content="details"[\s\S]*MatchingOptInPanel/);
  assert.doesNotMatch(workspace, />Organisation du dossier<|Détails et fonctions avancées|Informations détaillées/);
});
