import assert from "node:assert/strict";
import test from "node:test";
import { validateTemplateDraftQuality } from "../../lib/ai/template-draft-quality";

const provenance = {
  provider: "mock",
  model: "scenario",
  promptVersion: "template-designer-fr-v1",
  language: "fr",
  generatedAt: "2026-06-14T12:00:00.000Z",
};

function validDraft() {
  return {
    name: "Parcours partenaire",
    actors: [{ name: "Responsable", role: "Valide le dossier" }],
    stages: [{ name: "Validation", objective: "Valider le dossier", expectedAction: "Relire le dossier", responsibleActor: "Responsable", deadline: "Sous 2 jours" }],
    documents: [],
    relationalRequests: [{ title: "Demande de validation", description: "Faire valider le dossier", stage: 1, targetActor: "Responsable", deadline: "Sous 2 jours" }],
    kpis: [{ name: "Délai de validation", description: "Temps avant validation", unit: "jours" }],
    fields: [{ label: "Nom complet" }],
  };
}

test("accepts a complete French draft with provenance", () => {
  const result = validateTemplateDraftQuality({ draft: validDraft(), provenance });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("reports every critical structural requirement", () => {
  const result = validateTemplateDraftQuality({ draft: { name: "English workflow", status: "PUBLISHED" }, provenance: null });
  assert.equal(result.valid, false);
  assert.deepEqual(new Set(result.errors.map((issue) => issue.code)), new Set([
    "MISSING_ACTOR", "MISSING_STAGE", "MISSING_RELATIONAL_INPUT", "MISSING_KPI", "NON_FRENCH_LABELS", "PUBLISHED_DRAFT", "MISSING_PROVENANCE",
  ]));
});

test("returns warnings without blocking persistence", () => {
  const draft = validDraft();
  draft.stages = Array.from({ length: 9 }, (_, index) => ({ name: `Étape ${index + 1}`, objective: "Préparer le dossier" })) as typeof draft.stages;
  draft.relationalRequests = [{ title: "Demande de document", description: "Transmettre le document", stage: 1 }] as typeof draft.relationalRequests;
  const result = validateTemplateDraftQuality({ draft, provenance });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((issue) => issue.code === "TOO_MANY_STAGES"));
  assert.ok(result.warnings.some((issue) => issue.code === "MISSING_DEADLINE"));
  assert.ok(result.warnings.some((issue) => issue.code === "MISSING_RESPONSIBLE_ACTOR"));
  assert.ok(result.warnings.some((issue) => issue.code === "MISSING_EXPECTED_ACTION"));
  assert.ok(result.warnings.some((issue) => issue.code === "MISSING_TARGET_ACTOR"));
});

test("rejects English-only labels", () => {
  const draft = validDraft();
  Object.assign(draft, {
    name: "Partner workflow",
    actors: [{ name: "Owner", role: "Reviews requests" }],
    stages: [{ name: "Review stage", objective: "Review documents", expectedAction: "Approve request", responsibleActor: "Owner", deadline: "Two days" }],
    relationalRequests: [{ title: "Approval request", description: "Review documents", stage: 1, targetActor: "Owner", deadline: "Two days" }],
    kpis: [{ name: "Approval time", description: "Time before approval", unit: "days" }],
    fields: [{ label: "Full name" }],
  });
  const result = validateTemplateDraftQuality({ draft, provenance });
  assert.ok(result.errors.some((issue) => issue.code === "NON_FRENCH_LABELS"));
});
