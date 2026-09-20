import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { allowedCurrentStateStatements, CURRENT_STATE_EXPLAIN_SYSTEM, currentStateIsEmpty, validateCurrentStateExplanation } from "../lib/ai/governance/explain-current-state.ts";

const read = (path: string) => readFileSync(path, "utf8");
const state = { decisions: { count: 1 }, facts: { establishedCount: 0, disputedCount: 1 }, sources: null, peopleAndRoles: { participantCount: 3, activeRoleCount: 3, vacantRoleCount: 0 }, clarifications: [], nextMeeting: null };

test("uses only factual sentences backed by Current State", () => {
  const allowed = allowedCurrentStateStatements(state);
  assert.ok(allowed.includes("Une décision est actuellement en vigueur."));
  assert.ok(allowed.includes("Un fait est actuellement contesté."));
  assert.ok(allowed.includes("3 participants sont actuellement actifs."));
  assert.equal(validateCurrentStateExplanation(JSON.stringify({ statements: [allowed[0], allowed[1]] }), allowed), `${allowed[0]} ${allowed[1]}`);
});

test("rejects normative, false and invented model statements", () => {
  const allowed = allowedCurrentStateStatements(state);
  for (const statement of ["C'est une bonne décision.", "Ce fait est faux.", "Le risque est faible.", "Depuis hier le groupe avance normalement.", "Une source cachée existe."]) {
    assert.throws(() => validateCurrentStateExplanation(JSON.stringify({ statements: [statement] }), allowed), /AI_OUTPUT_INVALID/);
  }
  assert.throws(() => validateCurrentStateExplanation("texte brut", allowed), /AI_OUTPUT_INVALID/);
  assert.throws(() => validateCurrentStateExplanation(JSON.stringify({ statements: [] }), allowed), /AI_OUTPUT_INVALID/);
  assert.match(CURRENT_STATE_EXPLAIN_SYSTEM, /Ne recalcule aucun compteur/);
});

test("empty state has a deterministic path without provider", () => {
  assert.equal(currentStateIsEmpty({ decisions: null, facts: null, sources: null, peopleAndRoles: null, clarifications: [], nextMeeting: null }), true);
  assert.match(read("lib/ai/governance/explain-current-state-action.ts"), /if \(currentStateIsEmpty\(state\)\) return/);
});

test("server chain rebuilds context and only routes after egress validation", () => {
  const action = read("lib/ai/governance/explain-current-state-action.ts");
  assert.match(action, /buildGovernedJourneyAuthorizedAIContext\(\{ journeyId, capability: "explainCurrentState" \}\)/);
  assert.ok(action.indexOf("assertAuthorizedAIContextEgress(prepared)") < action.indexOf("await routeAI({"));
  assert.match(action, /classification: prepared.classification/);
  assert.match(action, /allowMock: false/);
  assert.doesNotMatch(action, /prisma\.|MISTRAL_API_KEY|createMistralProvider|governedMemoryFact\.create|governedMemoryEvent\.create/);
});

test("Current State payload excludes internal meeting ID, Journal and source content", () => {
  const context = read("lib/ai/governance/context.ts");
  const repository = read("lib/ai/governance/context-repository.ts");
  assert.match(context, /nextMeeting: projection.nextMeeting \? \{ scheduledAt:/);
  assert.match(context, /required\.sources && snapshot\.canViewSources/);
  assert.match(repository, /needsMemoryObjects = input\.capability !== "explainCurrentState"/);
  assert.match(context, /if \(capability === "explainCurrentState"\) return \{ currentState: true, memory: false, sources: false \}/);
  assert.doesNotMatch(read("lib/ai/governance/explain-current-state.ts"), /Journal\.find|prisma\./);
});

test("UI is explicit, asynchronous, dismissible and labelled as derived IA", () => {
  const ui = read("components/GovernedJourneyCurrentStateExplanation.tsx");
  assert.match(ui, /Expliquer la situation/);
  assert.match(ui, /Génération de l’explication/);
  assert.match(ui, /Masquer l’explication/);
  assert.match(ui, /Explication générée par IA à partir de l’état gouverné du Parcours/);
  assert.match(ui, /disabled=\{pending\}/);
  assert.doesNotMatch(ui, /useEffect|Mistral|fetch\(/);
});
