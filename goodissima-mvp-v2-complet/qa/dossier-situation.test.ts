import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDossierSituation, type DossierSituationInput } from "../lib/dossier-situation.ts";
import { humanizeAIEvent, humanizeRelationEvent } from "../lib/events/humanize.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function baseInput(overrides: Partial<DossierSituationInput> = {}): DossierSituationInput {
  return {
    status: "REVIEWING",
    governanceStatus: "ACTIVE",
    priority: "NORMAL",
    matchingEnabled: false,
    createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    documents: [],
    relationEvents: [{ id: "event-1", type: "MESSAGE_SENT", createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString() }],
    relationActions: [],
    ...overrides,
  };
}

const fullCandidateIdentity = {
  displayName: "Candidate Example",
  displayEmail: "candidate@example.test",
  status: "Identifié" as const,
  hasName: true,
  hasEmail: true,
  isMissingIdentity: false,
};

test("renders one compact dossier situation before the detailed analysis", () => {
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  const workspace = source("components/AIWorkspace.tsx");
  assert.equal((orchestrator.match(/Situation du dossier/g) ?? []).length, 1);
  assert.match(orchestrator, /Que dois-je comprendre et faire maintenant \?/);
  assert.match(orchestrator, /data-dossier-situation/);
  assert.match(workspace, /hidden=\{!analysisOpen\}/);
});

test("detects missing documents from pending document requests", () => {
  const situation = buildDossierSituation(baseInput({
    relationActions: [{
      id: "action-1",
      type: "DOCUMENT_REQUEST",
      status: "PENDING",
      title: "Justificatif de revenus",
      createdAt: new Date().toISOString(),
    }],
  }));

  assert.equal(situation.status, "Incomplet");
  assert.equal(situation.missingDocumentsCount, 1);
  assert.equal(situation.openRelationalRequestsCount, 1);
  assert.equal(situation.evidence.missingDocument, "Justificatif de revenus");
});

test("assigns green status when dossier is up to date", () => {
  const situation = buildDossierSituation(baseInput({ candidateIdentity: fullCandidateIdentity }));

  assert.equal(situation.operationalStatus.level, "UP_TO_DATE");
  assert.equal(situation.operationalStatus.label, "À jour");
  assert.ok(situation.operationalStatus.reasons.includes("Aucun blocage détecté"));
});

test("assigns yellow status when an action is recommended", () => {
  const situation = buildDossierSituation(baseInput({
    candidateIdentity: fullCandidateIdentity,
    relationActions: [{
      id: "action-yellow",
      type: "DOCUMENT_REQUEST",
      status: "PENDING",
      title: "Justificatif de domicile",
      createdAt: new Date().toISOString(),
    }],
  }));

  assert.equal(situation.operationalStatus.level, "RECOMMENDED_ACTION");
  assert.equal(situation.operationalStatus.label, "Action recommandée");
  assert.match(situation.operationalStatus.reasons.join(" "), /Justificatif de domicile/);
});

test("assigns orange status when dossier progression is at risk", () => {
  const situation = buildDossierSituation(baseInput({
    candidateIdentity: fullCandidateIdentity,
    relationActions: [
      {
        id: "action-orange-1",
        type: "DOCUMENT_REQUEST",
        status: "PENDING",
        title: "Pièce d'identité",
        createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      },
      {
        id: "action-orange-2",
        type: "DOCUMENT_REQUEST",
        status: "PENDING",
        title: "Justificatif de revenus",
        createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      },
    ],
  }));

  assert.equal(situation.operationalStatus.level, "NEEDS_ATTENTION");
  assert.equal(situation.operationalStatus.label, "Attention requise");
  assert.match(situation.operationalStatus.reasons.join(" "), /2 documents manquants/);
});

test("assigns red status when dossier is blocked", () => {
  const situation = buildDossierSituation(baseInput({
    candidateIdentity: fullCandidateIdentity,
    governanceStatus: "BLOCKED",
  }));

  assert.equal(situation.operationalStatus.level, "BLOCKED");
  assert.equal(situation.operationalStatus.label, "Dossier bloqué");
  assert.match(situation.operationalStatus.reasons.join(" "), /gouvernance/i);
});

test("assigns blue status for a new dossier with insufficient activity", () => {
  const situation = buildDossierSituation(baseInput({
    status: "NEW",
    createdAt: new Date().toISOString(),
    relationEvents: [],
    relationActions: [],
    documents: [],
    candidateIdentity: fullCandidateIdentity,
  }));

  assert.equal(situation.operationalStatus.level, "NEW");
  assert.equal(situation.operationalStatus.label, "Nouveau dossier");
  assert.match(situation.operationalStatus.reasons.join(" "), /Aucune activité exploitable/);
});

test("renders status explainability and accessible labels", () => {
  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  const workspace = source("components/AIWorkspace.tsx");

  assert.match(orchestrator, /Pourquoi ce statut \?/);
  assert.match(orchestrator, /operationalStatus\.reasons\.map/);
  assert.match(orchestrator, /aria-label=\{`Statut du dossier : \$\{situation\.operationalStatus\.label\}`\}/);
  assert.match(orchestrator, /dark:bg-/);
  assert.match(workspace, /aria-controls="ai-workspace-analysis"|ai-workspace-analysis/);
});

test("detects blockers from governance and open requests", () => {
  const blocked = buildDossierSituation(baseInput({ governanceStatus: "BLOCKED" }));
  assert.equal(blocked.status, "Bloqué");
  assert.equal(blocked.recommendedActionType, "SIGNALS");
  assert.ok(blocked.detectedBlockersCount >= 1);

  const waiting = buildDossierSituation(baseInput({
    relationActions: [{
      id: "action-2",
      type: "VALIDATION",
      status: "PENDING",
      title: "Validation dossier",
      createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    }],
  }));
  assert.equal(waiting.status, "À surveiller");
  assert.ok(waiting.detectedBlockersCount >= 1);
});

test("renders recommended action and explainable evidence", () => {
  const situation = buildDossierSituation(baseInput({
    relationActions: [{
      id: "action-3",
      type: "DOCUMENT_REQUEST",
      status: "PENDING",
      title: "Pièce générique",
      createdAt: new Date().toISOString(),
    }],
  }));
  assert.equal(situation.recommendedAction, "Préparer une relance documentaire.");
  assert.equal(situation.recommendedActionType, "DOCUMENT_REQUEST");

  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  assert.match(orchestrator, /Action recommandée/);
  assert.match(orchestrator, /Pourquoi cette recommandation \?/);
  assert.match(orchestrator, /Dernier événement/);
  assert.match(orchestrator, /Document manquant/);
  assert.match(orchestrator, /Demande ouverte/);
});

test("humanizes audit events in recommendation evidence for standard users", () => {
  const situation = buildDossierSituation(baseInput({
    relationEvents: [{
      id: "event-ai",
      type: "AI_SUGGESTED_ACTION_ACCEPTED",
      createdAt: new Date().toISOString(),
    }],
  }));

  assert.equal(situation.evidence.lastEvent, "Suggestion IA validee");
  assert.doesNotMatch(situation.evidence.lastEvent ?? "", /AI_SUGGESTED_ACTION_ACCEPTED/);
});

test("event translation layer never exposes unknown raw enums by default", () => {
  assert.equal(humanizeRelationEvent("AI_SUGGESTED_ACTION_CREATED").title, "Suggestion IA creee");
  assert.equal(humanizeRelationEvent("DOCUMENT_REQUESTED").title, "Demande de document");
  assert.equal(humanizeRelationEvent("DOCUMENT_RECEIVED").title, "Document recu");
  assert.equal(humanizeRelationEvent("RELATIONSHIP_REQUEST_CREATED").title, "Demande de mise en relation");
  assert.equal(humanizeRelationEvent("RELATIONSHIP_ACCEPTED").title, "Mise en relation acceptee");
  assert.equal(humanizeRelationEvent("TEMPLATE_PUBLISHED").title, "Parcours publie");

  assert.equal(humanizeAIEvent("UNKNOWN_INTERNAL_ENUM").title, "Evenement du dossier");
  assert.doesNotMatch(humanizeAIEvent("UNKNOWN_INTERNAL_ENUM").title, /UNKNOWN_INTERNAL_ENUM/);
  assert.equal(humanizeAIEvent("UNKNOWN_INTERNAL_ENUM", { includeRaw: true }).title, "UNKNOWN_INTERNAL_ENUM");
});

test("raw audit codes are rendered only in owner debug diagnostics", () => {
  const workspace = source("components/RelationCaseWorkspace.tsx");

  assert.match(workspace, /debugMode && senderType === "OWNER"/);
  assert.match(workspace, /Code audit: \{log\.eventType\}/);
  assert.match(workspace, /humanizeAIEvent\(log\.eventType\)\.title/);
});

test("uses draft-first behavior without automatic send or contact", () => {
  const workspace = source("components/AIWorkspace.tsx");
  const drafts = source("components/AIDraftAssistantPanel.tsx");
  const orchestrator = source("components/AIOrchestratorPanel.tsx");

  assert.match(workspace, /goodissima:prepare-ai-draft/);
  assert.match(workspace, /setActiveTab\("drafts"\)/);
  assert.match(orchestrator, /onPrepareDraft\("FOLLOW_UP"/);
  assert.match(orchestrator, /onPrepareDraft\("DOCUMENT_REQUEST"/);
  assert.match(drafts, /window\.addEventListener\("goodissima:prepare-ai-draft"/);
  assert.match(drafts, /setDraftType\(detail\.draftType\)/);
  assert.match(drafts, /setInstruction\(detail\.instruction \?\? ""\)/);

  const prefillBlock = drafts.match(/function prefillDraft[\s\S]*?window\.addEventListener/)?.[0] ?? "";
  assert.doesNotMatch(prefillBlock, /sendMessage/);
  assert.doesNotMatch(prefillBlock, /generateDraft\(/);
  assert.doesNotMatch(orchestrator, /fetch\(/);
});

test("supports generic parcours without domain-specific assumptions", () => {
  const situation = buildDossierSituation(baseInput({
    status: "WAITING_OWNER",
    relationActions: [{
      id: "action-4",
      type: "TASK",
      status: "PENDING",
      title: "Étape administrative à confirmer",
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    }],
    documents: [{ id: "doc-1", fileName: "dossier.pdf", createdAt: new Date().toISOString() }],
  }));

  assert.equal(situation.missingDocumentsCount, 0);
  assert.equal(situation.pendingRelationshipActionsCount, 1);
  assert.equal(situation.evidence.openRequest, "Étape administrative à confirmer");
  assert.doesNotMatch(situation.recommendedAction, /loyer|surface|contrat|investissement/i);
});
