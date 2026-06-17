import assert from "node:assert/strict";
import test from "node:test";
import { validateTemplateDraftQuality } from "../lib/ai/template-draft-quality.ts";
import { addJourneyStage, buildManualJourneyVersionPlan, deleteJourneyStage, reorderJourneyStage, updateJourneyStage, type EditableJourneyDesign } from "../lib/manual-journey-editor.ts";

function design(): EditableJourneyDesign {
  return {
    actors: [{ name: "Responsable", role: "Valide le dossier" }],
    stages: [
      { name: "Collecte", objective: "Collecter les documents", responsibleActor: "Responsable", expectedAction: "Relire", exitCondition: "Dossier complet", deadline: "Sous 2 jours" },
      { name: "Validation", objective: "Valider la demande", responsibleActor: "Responsable", expectedAction: "Décider", exitCondition: "Décision enregistrée", deadline: "Sous 3 jours" },
    ],
    documents: [{ name: "Pièce d'identité", required: true, stage: 1 }],
    relationalRequests: [{ title: "Confirmer le dossier", description: "Confirmer les informations", stage: 2, targetActor: "Responsable", deadline: "Sous 3 jours" }],
    kpis: [{ name: "Délai de validation", description: "Temps de traitement", unit: "jours" }],
  };
}

test("adds a stage", () => {
  const result = addJourneyStage(design());
  assert.equal(result.stages.length, 3);
  assert.equal(result.stages[2].name, "Nouvelle étape");
});

test("edits a stage", () => {
  const result = updateJourneyStage(design(), 0, { name: "Réception", expectedAction: "Vérifier les pièces" });
  assert.equal(result.stages[0].name, "Réception");
  assert.equal(result.stages[0].expectedAction, "Vérifier les pièces");
});

test("deletes a stage and remaps dependent stage numbers", () => {
  const result = deleteJourneyStage(design(), 0);
  assert.deepEqual(result.stages.map((stage) => stage.name), ["Validation"]);
  assert.equal(result.documents[0].stage, 1);
  assert.equal(result.relationalRequests[0].stage, 1);
});

test("reorders stages and keeps document/request references aligned", () => {
  const result = reorderJourneyStage(design(), 0, 1);
  assert.deepEqual(result.stages.map((stage) => stage.name), ["Validation", "Collecte"]);
  assert.equal(result.documents[0].stage, 2);
  assert.equal(result.relationalRequests[0].stage, 1);
});

test("runs Quality Guard after an edit and blocks only critical errors", () => {
  const edited = { ...design(), stages: [] };
  const validation = validateTemplateDraftQuality({ draft: { name: "Parcours de validation", ...edited, fields: [] }, requireProvenance: false });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((issue) => issue.code === "MISSING_STAGE"));
  const warningOnly = validateTemplateDraftQuality({ draft: { name: "Parcours de validation", ...design(), stages: design().stages.map((stage) => ({ ...stage, deadline: undefined })), fields: [] }, requireProvenance: false });
  assert.equal(warningOnly.valid, true);
  assert.ok(warningOnly.warnings.length > 0);
});

test("creates a new unpublished DRAFT version plan without mutating source", () => {
  const source = design();
  const edited = addJourneyStage(source);
  const sourceSnapshot = { relationTemplate: { name: "Parcours" }, fields: [], design: source, metadata: { snapshotVersion: 2, lifecycle: "DRAFT" } };
  const plan = buildManualJourneyVersionPlan({ sourceVersion: { id: "v1", version: 1, isPublished: false }, newVersion: 2, userId: "user-1", sourceSnapshot, previousDesign: source, design: edited, reason: "Adaptation terrain", timestamp: "2026-06-15T15:00:00.000Z" });
  assert.equal(plan.isPublished, false);
  assert.equal((plan.snapshot.metadata.manualEdit as { newVersion: number }).newVersion, 2);
  assert.equal(source.stages.length, 2);
});

test("creates a complete audit record", () => {
  const source = design();
  const plan = buildManualJourneyVersionPlan({ sourceVersion: { id: "v4", version: 4, isPublished: false }, newVersion: 5, userId: "user-7", sourceSnapshot: { metadata: { lifecycle: "DRAFT" } }, previousDesign: source, design: updateJourneyStage(source, 0, { name: "Réception" }), reason: "Terminologie métier", timestamp: "2026-06-15T15:00:00.000Z" });
  assert.equal(plan.audit.userId, "user-7");
  assert.equal(plan.audit.sourceVersionId, "v4");
  assert.equal(plan.audit.changeType, "MANUAL_JOURNEY_EDIT");
  assert.equal(plan.audit.reason, "Terminologie métier");
  assert.ok(plan.audit.changedFields.length > 0);
});

test("protects published versions", () => {
  assert.throws(() => buildManualJourneyVersionPlan({ sourceVersion: { id: "published", version: 3, isPublished: true }, newVersion: 4, userId: "user-1", sourceSnapshot: { metadata: { lifecycle: "PUBLISHED" } }, previousDesign: design(), design: addJourneyStage(design()), timestamp: "2026-06-15T15:00:00.000Z" }), /PUBLISHED_VERSION_PROTECTED/);
});
