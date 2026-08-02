import assert from "node:assert/strict";
import test from "node:test";
import { hasDirectedCycle, isAllowedRelation, sourceIsPresentable, sourceMayBeSecondaryEvidence, synthesisMayBeUsedAsSource } from "../lib/governed-memory/invariants.ts";
import { validateDecision, validateEvent, validateExactKeys, validateFact, validatePrivateMessagePromotion, validateRelation, validateSource, validateSynthesis } from "../lib/governed-memory/validation.ts";
import type { GovernedMemoryDecision, GovernedMemoryFact, GovernedMemoryObjectRef, GovernedMemoryScope, GovernedMemorySource, GovernedMemorySynthesis } from "../lib/governed-memory/types.ts";

const now = "2026-08-03T12:00:00.000Z";
const caseA = { type: "RELATION_CASE", relationCaseId: "case-a" } as GovernedMemoryScope;
const caseB = { type: "RELATION_CASE", relationCaseId: "case-b" } as GovernedMemoryScope;
const visibility = { kind: "CASE_PARTICIPANTS" } as const;

function fact(overrides: Partial<GovernedMemoryFact> = {}): GovernedMemoryFact {
  return { id: "fact-1", scope: caseA, statement: "Le document a été reçu.", status: "PROPOSED", evidenceLevel: "DECLARED", authorUserId: "user-1", authorRepresentationId: null, recordedAt: "2026-08-03T10:00:00.000Z", effectiveFrom: "2026-07-01T00:00:00.000Z", effectiveUntil: null, sourceRefs: [], establishedByUserId: null, establishedAt: null, supersedesFactId: null, supersededByFactId: null, disputeRefs: [], visibility, evidenceNote: "ESTABLISHED_WITHOUT_DOCUMENTARY_EVIDENCE", ...overrides } as GovernedMemoryFact;
}

function decision(overrides: Partial<GovernedMemoryDecision> = {}): GovernedMemoryDecision {
  return { id: "decision-1", scope: caseA, title: "Continuer l’analyse", rationale: "Motif humain explicite", status: "VALIDATED", decidedByUserId: "user-1", validatedByUserId: "user-2", decidedAt: "2026-08-03T09:00:00.000Z", recordedAt: "2026-08-03T10:00:00.000Z", effectiveFrom: "2026-08-03T09:00:00.000Z", effectiveUntil: null, sourceRefs: [], factRefs: [], priorDecisionRefs: [], consequences: [], reservations: [], visibility, validationState: "VALIDATED", evidenceNote: "DECIDED_WITHOUT_DOCUMENTARY_SOURCE", ...overrides } as GovernedMemoryDecision;
}

function source(overrides: Partial<GovernedMemorySource> = {}): GovernedMemorySource {
  return { id: "source-1", scope: caseA, kind: "DOCUMENT", status: "ACTIVE", sourceObjectType: "Document", sourceObjectId: "doc-1", title: "Pièce", authoredAt: null, receivedAt: null, recordedAt: "2026-08-03T10:00:00.000Z", promotedByUserId: null, promotedAt: null, visibility, integrityRef: null, versionRef: null, retentionPolicyRef: null, unavailableReason: null, externalOrigin: null, primarySourceRefs: [], ...overrides } as GovernedMemorySource;
}

function synthesis(overrides: Partial<GovernedMemorySynthesis> = {}): GovernedMemorySynthesis {
  return { id: "syn-1", scope: caseA, query: "Où en étions-nous ?", referenceDate: null, generatedAt: now, generatedBy: "AI_ASSISTANT", content: "Résumé temporaire", factRefs: [], decisionRefs: [], sourceRefs: [], synthesisRefs: [], limitations: [], inferences: [], status: "GENERATED_UNVERIFIED", validatedByUserId: null, validatedAt: null, supersedesSynthesisId: null, corpusFingerprint: null, visibility, hasDisputedDependency: false, ...overrides } as GovernedMemorySynthesis;
}

test("facts distinguish status from evidence and enforce establishment state", () => {
  assert.equal(validateFact(fact(), now).ok, true);
  const invalid = validateFact(fact({ status: "ESTABLISHED", establishedAt: null, establishedByUserId: null }), now);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.ok(invalid.issues.some((entry) => entry.code === "ESTABLISHMENT_REQUIRED"));
});

test("validated decisions require human rationale and cannot reference themselves", () => {
  assert.equal(validateDecision(decision(), now).ok, true);
  assert.equal(validateDecision(decision({ rationale: "" }), now).ok, false);
  assert.equal(validateDecision(decision({ priorDecisionRefs: [{ decisionId: "decision-1", relation: "REPLACES" }] as never }), now).ok, false);
});

test("source lifecycle keeps deleted content unavailable and secondary evidence traceable", () => {
  const deleted = source({ status: "DELETED", unavailableReason: "Retention terminée" });
  assert.equal(validateSource(deleted, now).ok, true);
  assert.equal(sourceIsPresentable(deleted), false);
  assert.equal(sourceMayBeSecondaryEvidence(source({ kind: "VALIDATED_SYNTHESIS" })), false);
  assert.equal(sourceMayBeSecondaryEvidence(source({ kind: "VALIDATED_SYNTHESIS", primarySourceRefs: ["primary-1"] as never })), true);
});

test("events separate system and human actors without implying a fact", () => {
  const base = { id: "event-1", scope: caseA, type: "SOURCE_ADDED", actorType: "SYSTEM", actorUserId: null, actorRepresentationId: null, occurredAt: now, recordedAt: now, objectRefs: [], summary: "Source enregistrée", visibility } as const;
  assert.equal(validateEvent(base as never).ok, true);
  assert.equal(validateEvent({ ...base, actorUserId: "user-1" } as never).ok, false);
});

test("private message promotion is explicit, bounded and cannot broaden visibility", () => {
  const valid = { relationCaseId: "case-a", messageId: "message-1", excerpt: "Extrait choisi", visibility: { kind: "PRIVATE_TO_AUTHOR" }, purpose: "Établir le contexte", consentBasis: { type: "AUTHOR_PROMOTED_OWN_MESSAGE" } } as const;
  assert.equal(validatePrivateMessagePromotion(valid as never, { kind: "PRIVATE_TO_AUTHOR" }).ok, true);
  assert.equal(validatePrivateMessagePromotion({ ...valid, consentBasis: undefined } as never, { kind: "PRIVATE_TO_AUTHOR" }).ok, false);
  assert.equal(validatePrivateMessagePromotion({ ...valid, excerpt: "x".repeat(2_001) } as never, { kind: "PRIVATE_TO_AUTHOR" }).ok, false);
  assert.equal(validatePrivateMessagePromotion({ ...valid, visibility: { kind: "CASE_PARTICIPANTS" } } as never, { kind: "PRIVATE_TO_AUTHOR" }).ok, false);
});

test("relations are typed, same-case and reject self replacement", () => {
  const from = { type: "FACT", id: "fact-1", scope: caseA } as GovernedMemoryObjectRef;
  const sourceRef = { type: "SOURCE", id: "source-1", scope: caseA } as GovernedMemoryObjectRef;
  assert.equal(isAllowedRelation({ scope: caseA, type: "SUPPORTED_BY", from, to: sourceRef }), true);
  assert.equal(validateRelation({ scope: caseA, type: "SUPPORTED_BY", from, to: { ...sourceRef, scope: caseB } }).ok, false);
  assert.equal(isAllowedRelation({ scope: caseA, type: "REPLACES", from, to: from }), false);
});

test("replacement and recursive synthesis cycles are detected", () => {
  assert.equal(hasDirectedCycle([{ from: "a", to: "b" }, { from: "b", to: "c" }]), false);
  assert.equal(hasDirectedCycle([{ from: "a", to: "b" }, { from: "b", to: "a" }]), true);
});

test("unverified synthesis cannot be secondary evidence and limitations stay explicit", () => {
  const draft = synthesis();
  assert.equal(validateSynthesis(draft).ok, true);
  assert.equal(synthesisMayBeUsedAsSource(draft), false);
  const approved = synthesis({ status: "VALIDATED", validatedAt: now, validatedByUserId: "user-1" as never });
  assert.equal(validateSynthesis(approved).ok, true);
  assert.equal(synthesisMayBeUsedAsSource(approved), true);
});

test("unknown fields receive a stable issue code", () => {
  assert.deepEqual(validateExactKeys({ statement: "ok", surprise: true }, ["statement"]), [{ code: "UNKNOWN_FIELD", path: "surprise", message: "Unknown fields are not allowed." }]);
});
