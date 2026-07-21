import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  filterSignalsByWorkspaceId,
  selectDeterministicMatchingSources,
  summarizeGovernanceAttention,
  toGovernanceAIAttention,
} from "../lib/governance-attention.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const repository = read("lib/governance-pilotage-repository.ts");

test("keeps the GLink matching signal visible with zero, one or several cases", () => {
  assert.match(repository, /if \(!link\.template \|\| !parseGLinkMatchingState\(link\.rules\)\.enabled\) continue/);
  assert.doesNotMatch(repository, /link\.cases\.length/);
  assert.doesNotMatch(repository, /cases: \{ where: \{ matchingEnabled: true \}/);
});

test("emits exactly one link signal regardless of its case count", () => {
  for (const linkCaseCount of [0, 1, 3]) {
    assert.deepEqual(selectDeterministicMatchingSources({ linkMatchingActive: true, linkHasUsefulCriteria: true, linkCaseCount, historicalCaseMatchingCount: linkCaseCount }), ["LINK"]);
  }
});

test("prioritizes active link matching and otherwise keeps historical compatibility", () => {
  assert.deepEqual(selectDeterministicMatchingSources({ linkMatchingActive: true, linkHasUsefulCriteria: true, linkCaseCount: 1, historicalCaseMatchingCount: 1 }), ["LINK"]);
  assert.deepEqual(selectDeterministicMatchingSources({ linkMatchingActive: false, linkHasUsefulCriteria: false, linkCaseCount: 1, historicalCaseMatchingCount: 1 }), ["HISTORICAL_CASE"]);
});

test("isolates same-named Workspaces with stable IDs", () => {
  const signals = [
    { workspaceId: "workspace-a", workspace: "Même nom", marker: "a" },
    { workspaceId: "workspace-b", workspace: "Même nom", marker: "b" },
  ];
  assert.deepEqual(filterSignalsByWorkspaceId(signals, "workspace-a").map((signal) => signal.marker), ["a"]);
});

test("counts only actionable intervention kinds", () => {
  const attention = summarizeGovernanceAttention({
    signals: ["ACTION", "MATCHING", "ACCESS", "UPCOMING", "RECENT", "HISTORY"].map((kind) => ({ kind: kind as "ACTION" | "MATCHING" | "ACCESS" | "UPCOMING" | "RECENT" | "HISTORY", href: `/${kind.toLowerCase()}` })),
    scope: "GLOBAL",
    fallbackHref: "/gouvernance/pilotage",
  });
  assert.deepEqual(attention.map((signal) => signal.type), ["HUMAN_INTERVENTION_REQUIRED", "MATCHING_REVIEW_REQUIRED", "ACCESS_INTERVENTION_REQUIRED"]);
  assert.equal(attention.reduce((count, signal) => count + signal.count, 0), 3);
});

test("projects AI attention without navigation or business identifiers", () => {
  const projected = toGovernanceAIAttention([{ type: "MATCHING_REVIEW_REQUIRED", priority: "HIGH", count: 1, scope: "WORKSPACE", scopeId: "workspace-secret", label: "1 demande", href: "/links/link-secret#matching" }]);
  assert.deepEqual(projected, [{ type: "MATCHING_REVIEW_REQUIRED", priority: "HIGH", count: 1, scope: "WORKSPACE" }]);
  assert.deepEqual(Object.keys(projected[0]), ["type", "priority", "count", "scope"]);
});

test("uses active GLink matching before historical case compatibility", () => {
  assert.match(repository, /selectDeterministicMatchingSources\(\{ linkMatchingActive: parseGLinkMatchingState\(relationCase\.gLink\.rules\)\.enabled/);
  assert.match(repository, /if \(!historicalSource\.includes\("HISTORICAL_CASE"\)\) continue/);
  assert.match(repository, /Capacité historique du dossier/);
  assert.match(repository, /elle ne représente pas le matching global de la demande/);
  assert.match(repository, /Résultats historiques du dossier à examiner/);
  assert.match(repository, /href = `\/links\/\$\{link\.id\}#matching`/);
});

test("builds deterministic, scoped and non-sensitive attention counters", () => {
  const attention = read("lib/governance-attention.ts");
  const aiContext = read("lib/governance-ai-context-repository.ts");
  for (const field of ["type", "priority", "count", "scope", "scopeId", "label", "href"]) assert.match(attention, new RegExp(`${field}:`));
  assert.doesNotMatch(aiContext, /subject: signal|reason: signal|journey: signal|date: signal/);
  assert.match(aiContext, /attention: toGovernanceAIAttention\(attention\)/);
  assert.doesNotMatch(aiContext, /targetUrl: signal\.href|scopeId: signal\.scopeId/);
  assert.doesNotMatch(aiContext, /\{ id: item\.id|\{ id: workspace\.id/);
});

test("renders honest populated and empty summaries in Workspace and Pilotage", () => {
  const workspace = read("app/gouvernance/page.tsx");
  const pilotage = read("app/gouvernance/pilotage/page.tsx");
  const portfolio = read("app/gouvernance/portfolios/[id]/pilotage/page.tsx");
  assert.match(workspace, /À examiner/);
  assert.match(workspace, /Aucune intervention humaine requise détectée/);
  assert.match(pilotage, /Intervention humaine requise/);
  assert.match(pilotage, /Aucune intervention humaine requise détectée dans ce périmètre/);
  assert.match(portfolio, /scope: "PORTFOLIO"/);
});
