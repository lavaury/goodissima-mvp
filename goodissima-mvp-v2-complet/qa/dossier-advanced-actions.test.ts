import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const menu = source("components/DossierActionMenu.tsx");
const workspace = source("components/RelationCaseWorkspace.tsx");
const tabs = source("components/DossierWorkspaceTabs.tsx");

test("the header button and scoped right click expose the same dossier menu", () => {
  assert.match(workspace, /<DossierActionMenu/);
  assert.match(workspace, /data-dossier-context-surface="true"/);
  assert.equal(menu.split('role="menu"').length - 1, 1);
  assert.match(menu, /aria-label="Actions du dossier"/);
  assert.match(menu, /surface\.addEventListener\("contextmenu", context\)/);
  assert.match(menu, /input, textarea, select/);
  assert.match(menu, /data-conversation-zone/);
  assert.match(menu, /ArrowDown/);
  assert.match(menu, /event\.key === "Escape"/);
});

test("status, priority and governance reuse the existing owner-scoped PATCH route", () => {
  assert.match(menu, /fetch\(`\/api\/cases\/\$\{encodeURIComponent\(caseId\)\}`/);
  assert.match(menu, /RelationStatus\.WAITING_CANDIDATE/);
  assert.match(menu, /RelationPriority\.URGENT/);
  assert.match(menu, /governanceStatus: confirm\.status/);
  assert.match(menu, /status === RelationGovernanceStatus\.ACTIVE/);
  assert.match(menu, /status === RelationGovernanceStatus\.SUSPENDED/);
  assert.doesNotMatch(menu, /status === RelationGovernanceStatus\.(CLOSED|BLOCKED)[\s\S]{0,120}ACTIVE/);
});

test("sensitive actions have specialized accessible confirmations", () => {
  for (const copy of ["Suspendre temporairement la relation ?", "Clôturer la relation ?", "Bloquer la relation ?", "Reprendre la relation ?", "Archiver ce dossier ?"]) assert.ok(menu.includes(copy));
  assert.match(menu, /role="dialog"/);
  assert.match(menu, /aria-modal="true"/);
  assert.match(menu, /Motif facultatif/);
  assert.match(menu, /event\.key === "Tab"/);
});

test("details are calm and Boussole can reveal only the requested disclosure", () => {
  for (const section of ["identity", "governance", "access", "origin", "communication", "matching", "timeline", "audit"]) {
    assert.ok(workspace.includes(`data-dossier-section="${section}"`), `missing ${section}`);
  }
  assert.doesNotMatch(workspace, /data-dossier-section="[^"]+"[^>]* open/);
  assert.match(workspace, /Identité et confiance/);
  assert.match(tabs, /goodissima:open-dossier-section/);
  assert.match(tabs, /item !== disclosure/);
  assert.match(tabs, /disclosure\.open = true/);
});

test("workspace cascade warning is conditional and the existing server actions remain", () => {
  assert.match(workspace, /!item\.gLink\.workspaceId/);
  assert.match(workspace, /attachRelationCaseToWorkspaceAction/);
  assert.match(workspace, /detachRelationCaseFromWorkspaceAction/);
});
