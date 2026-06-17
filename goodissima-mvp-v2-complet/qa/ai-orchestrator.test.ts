import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("AI workspace exposes dossier situation as the default entry point", () => {
  const workspace = source("components/AIWorkspace.tsx");
  assert.match(workspace, /AIOrchestratorPanel/);
  assert.match(workspace, /id: "orchestrator", label: "Situation du dossier"/);
  assert.match(workspace, /useState<WorkspaceTab>\("orchestrator"\)/);
  assert.match(workspace, /<h2 className="text-lg font-semibold text-\[#2f3437\]">Situation du dossier<\/h2>/);
  assert.match(workspace, /WorkspaceOperationalStatusBadge situation=\{situation\}/);
  assert.match(workspace, /Résumé de l'état du dossier et actions recommandées/);
});

test("end-user AI workspace labels do not expose orchestration vocabulary", () => {
  const workspace = source("components/AIWorkspace.tsx");
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  const visibleSources = `${workspace}\n${orchestrator}`;

  assert.doesNotMatch(visibleSources, /Chef d'orchestre IA/);
  assert.doesNotMatch(visibleSources, /Chef d'orchestre"/);
  assert.doesNotMatch(visibleSources, /Orchestrateur/i);
  assert.match(orchestrator, /Situation du dossier/);
  assert.match(orchestrator, /Résumé de l'état du dossier et actions recommandées/);
});

test("orchestrator opens existing AI modules instead of duplicating feature logic", () => {
  const workspace = source("components/AIWorkspace.tsx");
  assert.match(workspace, /function openModule\(module: AIOrchestratorModule\)/);
  assert.match(workspace, /setActiveTab\(module\)/);
  assert.match(workspace, /AIRelationSummaryPanel caseId=\{caseId\} workspace/);
  assert.match(workspace, /AITimelineIntelligencePanel caseId=\{caseId\} workspace/);
  assert.match(workspace, /AIRiskSignalsPanel caseId=\{caseId\} workspace/);
  assert.match(workspace, /MatchingPanel caseId=\{caseId\} matchingEnabled=\{matchingEnabled\}/);
  assert.match(workspace, /AIDraftAssistantPanel caseId=\{caseId\} workspace/);
});

test("orchestrator presents the five requested capabilities", () => {
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  for (const label of ["Résumé IA", "Timeline IA", "Signaux IA", "Matching", "Brouillons IA"]) {
    assert.match(orchestrator, new RegExp(label));
  }
  assert.match(orchestrator, /Sortie attendue/);
  assert.match(orchestrator, /Opt-in requis/);
  assert.match(orchestrator, /onOpenModule\(step\.id\)/);
});

test("orchestrator keeps human validation and governance constraints explicit", () => {
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  assert.match(orchestrator, /Aucune décision automatique/);
  assert.match(orchestrator, /Aucun message, email ou contact envoyé automatiquement/);
  assert.match(orchestrator, /matching reste opt-in et pseudonymisé/);
  assert.match(orchestrator, /validées par un humain/);
  assert.match(orchestrator, /audit et l'observabilité existants/);
  assert.doesNotMatch(orchestrator, /fetch\(/);
  assert.doesNotMatch(orchestrator, /router\.push/);
});
