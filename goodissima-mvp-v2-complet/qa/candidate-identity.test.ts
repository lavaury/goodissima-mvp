import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  candidateIdentityRecommendation,
  candidateIdentityRequestTitle,
  resolveCandidateIdentityState,
} from "../lib/candidate-identity.ts";
import { buildDossierSituation, type DossierSituationInput } from "../lib/dossier-situation.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function baseInput(overrides: Partial<DossierSituationInput> = {}): DossierSituationInput {
  return {
    status: "NEW",
    governanceStatus: "ACTIVE",
    priority: "NORMAL",
    matchingEnabled: false,
    createdAt: new Date().toISOString(),
    documents: [],
    relationActions: [],
    relationEvents: [],
    ...overrides,
  };
}

test("no name/no email is explicitly non identified", () => {
  const state = resolveCandidateIdentityState({ id: "case-abcdef123456", candidateName: "", candidateEmail: "" });

  assert.equal(state.displayName, "Candidat #123456");
  assert.equal(state.displayEmail, "Contact non renseigné");
  assert.equal(state.status, "Non identifié");
  assert.equal(state.recommendation, candidateIdentityRecommendation);
});

test("name only is partially identified", () => {
  const state = resolveCandidateIdentityState({ id: "case-1", candidateName: "Jeanne Martin", candidateEmail: "" });

  assert.equal(state.displayName, "Jeanne Martin");
  assert.equal(state.displayEmail, "Contact non renseigné");
  assert.equal(state.status, "Partiellement identifié");
});

test("email only is partially identified without inventing a name", () => {
  const state = resolveCandidateIdentityState({ id: "case-abcdef", candidateName: "", candidateEmail: "ana@example.test" });

  assert.equal(state.displayName, "Candidat #ABCDEF");
  assert.equal(state.displayEmail, "ana@example.test");
  assert.equal(state.status, "Partiellement identifié");
});

test("full identity is identified", () => {
  const state = resolveCandidateIdentityState({ candidateName: "Ana Lopez", candidateEmail: "ana@example.test" });

  assert.equal(state.displayName, "Ana Lopez");
  assert.equal(state.displayEmail, "ana@example.test");
  assert.equal(state.status, "Identifié");
  assert.equal(state.recommendation, undefined);
});

test("orchestrator recommends candidate identification when identity is missing", () => {
  const situation = buildDossierSituation(baseInput({
    candidateIdentity: resolveCandidateIdentityState({ id: "case-abcdef", candidateName: "", candidateEmail: "" }),
  }));

  assert.equal(situation.identityStatus, "Non identifié");
  assert.equal(situation.recommendedAction, candidateIdentityRecommendation);
  assert.equal(situation.recommendedActionType, "IDENTITY_REQUEST");

  const orchestrator = source("components/AIOrchestratorPanel.tsx");
  assert.match(orchestrator, /Identité candidat/);
  assert.match(orchestrator, /Préparer la demande/);
  assert.match(orchestrator, /onRequestCoordinates/);

  const workspace = source("components/AIWorkspace.tsx");
  assert.match(workspace, /prepareDraft\("CLARIFICATION_REQUEST"/);
  assert.doesNotMatch(workspace, /fetch\(/);

  const actions = source("components/RelationActionsPanel.tsx");
  assert.match(actions, /candidateIdentityRequestTitle/);
  assert.match(actions, /draftOnly/);
});
