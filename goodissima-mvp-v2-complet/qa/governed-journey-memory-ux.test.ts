import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { JourneyMemoryProjection } from "../lib/governed-memory/contracts.ts";
import { projectJourneyMemoryView } from "../lib/governed-memory/journey-view.ts";

const at = "2026-09-15T12:00:00.000Z";
const provenance = { actorOrigin: "HUMAN" as const, recordedAt: at, sourceHandles: [] };
const capabilities = { canView: true, canViewSources: true, canPropose: true, canEstablishFact: true, canDispute: true, canRecordDecision: true, canValidateDecision: true, canRegisterSource: true };

function memory(overrides: Partial<JourneyMemoryProjection> = {}): JourneyMemoryProjection {
  return { facts: [], decisions: [], sources: [], pending: [], history: [], capabilities, ...overrides };
}

test("the journey view keeps facts, retained decisions, sources and pending work distinct", () => {
  const view = projectJourneyMemoryView(memory({
    facts: [
      { handle: "proposed", statement: "À vérifier", state: "proposed", evidenceLevel: "declared", provenance, contested: false, superseded: false, effectiveFrom: at, effectiveUntil: null, establishedAt: null },
      { handle: "established", statement: "Confirmé", state: "established", evidenceLevel: "supported", provenance, contested: false, superseded: false, effectiveFrom: at, effectiveUntil: null, establishedAt: at },
      { handle: "contested", statement: "Contesté", state: "contested", evidenceLevel: "contested", provenance, contested: true, superseded: false, effectiveFrom: at, effectiveUntil: null, establishedAt: at },
    ],
    decisions: [
      { handle: "draft", title: "Projet", rationale: "À examiner", state: "draft", provenance, decidedAt: at, validatedAt: null },
      { handle: "validated", title: "Retenue", rationale: "Motif", state: "validated", provenance, decidedAt: at, validatedAt: at },
    ],
    sources: [
      { handle: "expertise-a", title: "Expertise A", type: "Document", state: "active", provenance, available: true },
      { handle: "expertise-b", title: "Expertise B", type: "Document", state: "active", provenance, available: true },
    ],
    pending: [{ kind: "fact", handle: "proposed", label: "À vérifier", recordedAt: at }, { kind: "decision", handle: "draft", label: "Projet", recordedAt: at }],
  }));
  assert.deepEqual(view.facts.map((item) => item.handle), ["established", "contested"]);
  assert.deepEqual(view.decisions.map((item) => item.handle), ["validated"]);
  assert.deepEqual(view.sources.map((item) => item.handle), ["expertise-a", "expertise-b"]);
  assert.deepEqual(view.pending.map((item) => item.handle), ["proposed", "draft"]);
});

test("VIEW_SOURCES denial suppresses every source from the view", () => {
  const view = projectJourneyMemoryView(memory({ capabilities: { ...capabilities, canViewSources: false }, sources: [{ handle: "private", title: "Privée", type: "Document", state: "active", provenance, available: true }] }));
  assert.deepEqual(view.sources, []);
});

test("the cockpit exposes only supported human actions and keeps history separate", () => {
  const component = readFileSync(new URL("../components/GovernedJourneyMemorySection.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
  for (const label of ["Ce que nous retenons", "Faits", "Décisions", "Sources", "À confirmer", "Proposer un fait", "Ajouter une source", "Confirmer comme fait", "Confirmer la décision", "Contester"]) assert.match(component, new RegExp(label));
  assert.doesNotMatch(component, /Préparer une décision|recordJourneyDecisionAction/);
  assert.equal(page.match(/Préparer une décision/g)?.length, 1);
  assert.match(page, /action=\{prepareGovernanceReviewAction\}/);
  for (const unsupported of ["Réviser", "Révoquer", "Résoudre la contestation", "Maintenir la contestation", "Associer une source"]) assert.doesNotMatch(component, new RegExp(unsupported));
  assert.ok(page.indexOf("<GovernedJourneyMemorySection") < page.indexOf('<section id="history"'));
  assert.doesNotMatch(component, /governanceReviewPreparations|GovernanceReview/);
  assert.match(component, /overflow-hidden/);
  assert.match(component, /min-h-11/);
});
