import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDossierSituation, type DossierSituationInput } from "../lib/dossier-situation.ts";

const now = () => new Date().toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const completeIdentity = { displayName: "Candidate Example", displayEmail: "candidate@example.test", status: "Identifié" as const, hasName: true, hasEmail: true, isMissingIdentity: false };
const incompleteIdentity = { displayName: "Candidat non identifié", displayEmail: "Contact non renseigné", status: "Non identifié" as const, hasName: false, hasEmail: false, isMissingIdentity: true };

function input(overrides: Partial<DossierSituationInput> = {}): DossierSituationInput {
  return { status: "REVIEWING", governanceStatus: "ACTIVE", priority: "NORMAL", matchingEnabled: false, candidateIdentity: completeIdentity, createdAt: now(), documents: [], relationActions: [], relationEvents: [{ id: "event", type: "MESSAGE_SENT", createdAt: now() }], ...overrides };
}

function pending(type: string, title: string, age = 0) {
  return { id: `${type}-${age}`, type, status: "PENDING", title, createdAt: daysAgo(age) };
}

test("governance states outrank every relational action", () => {
  const blocked = buildDossierSituation(input({ governanceStatus: "BLOCKED", candidateIdentity: incompleteIdentity }));
  const suspended = buildDossierSituation(input({ governanceStatus: "SUSPENDED", relationActions: [pending("TASK", "Relancer", 8)], relationEvents: [] }));
  assert.equal(blocked.primary.kind, "GOVERNANCE");
  assert.equal(blocked.primary.title, "Relation bloquée");
  assert.equal(suspended.primary.kind, "GOVERNANCE");
  assert.equal(suspended.primary.title, "Relation suspendue");
});

test("closed relations and dossiers expose only a terminal state", () => {
  for (const overrides of [{ governanceStatus: "CLOSED" }, { status: "CLOSED" }, { status: "ARCHIVED" }]) {
    const result = buildDossierSituation(input(overrides));
    assert.equal(result.primary.kind, "TERMINAL");
    assert.equal(result.primary.actionType, "DETAILS");
  }
});

test("an active incomplete identity prepares the existing request flow once", () => {
  const missing = buildDossierSituation(input({ candidateIdentity: incompleteIdentity }));
  const alreadyRequested = buildDossierSituation(input({ candidateIdentity: incompleteIdentity, relationActions: [pending("TASK", "Demander les coordonnées")] }));
  assert.equal(missing.primary.kind, "IDENTITY_REQUEST");
  assert.equal(alreadyRequested.primary.kind, "NONE");
});

test("only stale open requests become the primary follow-up", () => {
  const document = buildDossierSituation(input({ createdAt: daysAgo(10), relationActions: [pending("DOCUMENT_REQUEST", "Pièce attendue", 6)], relationEvents: [] }));
  const generic = buildDossierSituation(input({ createdAt: daysAgo(10), relationActions: [pending("VALIDATION", "Validation attendue", 6)], relationEvents: [] }));
  const fresh = buildDossierSituation(input({ relationActions: [pending("VALIDATION", "Validation récente")], relationEvents: [] }));
  assert.equal(document.primary.kind, "DOCUMENT_FOLLOW_UP");
  assert.equal(generic.primary.kind, "FOLLOW_UP");
  assert.equal(fresh.primary.kind, "NONE");
  assert.match(fresh.followUps.join(" "), /demande en attente/);
});

test("matching and priority never create a primary action", () => {
  for (const overrides of [{ matchingEnabled: true }, { priority: "HIGH" }, { priority: "URGENT" }]) {
    assert.equal(buildDossierSituation(input(overrides)).primary.kind, "NONE");
  }
});

test("neutral state and its reason are explicit", () => {
  const result = buildDossierSituation(input());
  assert.equal(result.primary.title, "Rien ne nécessite actuellement votre attention.");
  assert.match(result.primary.reason, /Aucune condition/);
});

test("the orchestrator remains deterministic, draft-first and AI-independent", () => {
  const engine = readFileSync(new URL("../lib/dossier-situation.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/AIOrchestratorPanel.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/AIWorkspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(engine, /AIProvider|fetch\(|generate/);
  assert.match(panel, /À faire maintenant/);
  assert.match(panel, /Pourquoi \?/);
  assert.match(panel, /situation\.primary\.actionType/);
  assert.match(workspace, /goodissima:prepare-relation-request/);
  assert.doesNotMatch(panel, /fetch\(/);
});
