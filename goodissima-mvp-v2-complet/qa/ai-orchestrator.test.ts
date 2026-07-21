import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("AI workspace exposes one compact dossier situation before the analysis", () => {
  const workspace = source("components/AIWorkspace.tsx");
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  assert.match(workspace, /AIOrchestratorPanel/);
  assert.match(workspace, /useState<WorkspaceTab>\("details"\)/);
  assert.match(workspace, /useState\(false\)/);
  assert.match(workspace, /hidden=\{!analysisOpen\}/);
  assert.equal((orchestrator.match(/Situation du dossier/g) ?? []).length, 1);
  assert.match(orchestrator, /Que dois-je comprendre et faire maintenant \?/);
  assert.match(orchestrator, /situation\.recommendedAction/);
  assert.match(orchestrator, /Repères importants/);
});

test("end-user AI workspace labels do not expose orchestration vocabulary", () => {
  const workspace = source("components/AIWorkspace.tsx");
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  const visibleSources = `${workspace}\n${orchestrator}`;

  assert.doesNotMatch(visibleSources, /Chef d'orchestre IA/);
  assert.doesNotMatch(visibleSources, /Chef d'orchestre"/);
  assert.doesNotMatch(visibleSources, /Orchestrateur/i);
  assert.match(orchestrator, /Situation du dossier/);
  assert.match(orchestrator, /Que dois-je comprendre et faire maintenant \?/);
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

test("detailed analysis keeps every historical capability accessible", () => {
  const workspace = source("components/AIWorkspace.tsx");
  for (const label of ["Résumé IA", "Timeline IA", "Signaux IA", "Matching", "Brouillons IA"]) {
    assert.match(workspace, new RegExp(label));
  }
  assert.match(workspace, /AISituationDetails/);
  assert.match(workspace, /MatchingPanel/);
  assert.match(workspace, /setAnalysisOpen\(true\)/);
});

test("analysis uses vertical accordions without horizontal navigation", () => {
  const workspace = source("components/AIWorkspace.tsx");
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  assert.doesNotMatch(workspace, /role="tablist"/);
  assert.doesNotMatch(workspace, /overflow-x-auto/);
  assert.match(workspace, /accordions\.map/);
  for (const label of ["Informations de situation", "Résumé IA", "Timeline IA", "Signaux IA", "Brouillons IA"]) {
    assert.match(workspace, new RegExp(label));
  }
  assert.match(workspace, /space-y-2/);
  assert.match(workspace, /setActiveTab\(accordion\.id\)/);
});

test("analysis disclosure and accordions are keyboard and screen-reader understandable", () => {
  const workspace = source("components/AIWorkspace.tsx");
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  assert.match(orchestrator, /type="button"/);
  assert.match(orchestrator, /aria-expanded=\{analysisOpen\}/);
  assert.match(orchestrator, /aria-controls="ai-workspace-analysis"/);
  assert.match(orchestrator, /Voir l’analyse/);
  assert.match(workspace, /id="ai-workspace-analysis"/);
  assert.match(workspace, /aria-expanded=\{open\}/);
  assert.match(workspace, /aria-controls=\{panelId\}/);
  assert.match(workspace, /role="region"/);
  assert.match(workspace, /aria-labelledby=\{buttonId\}/);
});

test("analysis is closed by default and opening an accordion does not call AI", () => {
  const workspace = source("components/AIWorkspace.tsx");
  assert.match(workspace, /useState\(false\)/);
  assert.match(workspace, /hidden=\{!analysisOpen\}/);
  assert.match(workspace, /onClick=\{\(\) => setActiveTab\(accordion\.id\)\}/);
  assert.doesNotMatch(workspace, /onClick=\{\(\) => (?:void )?(?:fetch|generate|analy)/);
});

test("recommended action button uses the real action label", () => {
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  assert.match(orchestrator, /recommendedActionLabel\(situation\.recommendedActionType\)/);
  for (const label of ["Préparer le résumé", "Préparer la demande", "Préparer une relance", "Voir les signaux", "Voir la timeline"]) {
    assert.match(orchestrator, new RegExp(label));
  }
  assert.doesNotMatch(orchestrator, /Préparer cette action/);
  assert.match(orchestrator, /Prépare un brouillon sans l’envoyer automatiquement\./);
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
  assert.doesNotMatch(source("components/AIWorkspace.tsx"), /fetch\(/);
});
