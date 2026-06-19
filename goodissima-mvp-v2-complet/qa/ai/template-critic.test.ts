import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTemplateVersionQuality } from "../../lib/ai/template-critic";

function completeSnapshot(): Record<string, any> {
  return {
    relationTemplate: { id: "template-1", key: "PARTENAIRE", name: "Parcours partenaire", description: null },
    formTemplate: { id: "form-1", key: "PARTENAIRE_FORM", name: "Parcours partenaire", description: null },
    fields: [{ key: "nom", label: "Nom complet", type: "TEXT", required: true, step: 1 }],
    design: {
      actors: [{ name: "Responsable", role: "Valide le dossier" }],
      stages: [{
        name: "Validation",
        objective: "Valider le dossier",
        expectedAction: "Relire les informations",
        responsibleActor: "Responsable",
        deadline: "Sous 2 jours",
        exitCondition: "Une décision humaine est enregistrée",
      }],
      documents: [],
      relationalRequests: [{
        title: "Demande de validation",
        description: "Faire valider le dossier",
        stage: 1,
        targetActor: "Responsable",
        deadline: "Sous 2 jours",
        status: "OPEN",
      }],
      kpis: [{ name: "Délai de validation", description: "Temps avant validation", unit: "jours" }],
    },
    metadata: { snapshotVersion: 2 },
  };
}

test("scores a complete existing version without mutating it", () => {
  const snapshot = completeSnapshot();
  const before = structuredClone(snapshot);
  const report = analyzeTemplateVersionQuality({ snapshot, isPublished: true, analyzedAt: "2026-06-14T12:00:00.000Z" });
  assert.equal(report.overallQualityScore, 100);
  assert.deepEqual(report.criticalIssues, []);
  assert.deepEqual(report.warnings, []);
  assert.deepEqual(snapshot, before);
});

test("reuses quality guard structural rules but accepts a published version", () => {
  const snapshot = completeSnapshot();
  snapshot.design.actors = [];
  snapshot.design.kpis = [];
  const report = analyzeTemplateVersionQuality({ snapshot, isPublished: true });
  assert.ok(report.criticalIssues.some((item) => item.code === "MISSING_ACTOR"));
  assert.ok(report.criticalIssues.some((item) => item.code === "MISSING_KPI"));
  assert.ok(!report.criticalIssues.some((item) => item.code === "PUBLISHED_DRAFT"));
});

test("reports critic warnings and improvement suggestions", () => {
  const snapshot = completeSnapshot();
  snapshot.design.stages = [{ name: "Collecte", objective: "Collecter les pièces" }] as typeof snapshot.design.stages;
  snapshot.design.relationalRequests = Array.from({ length: 6 }, (_, index) => ({
    title: `Demande ${index + 1}`,
    description: "Transmettre une pièce",
    stage: 1,
    status: "OPEN",
  })) as typeof snapshot.design.relationalRequests;
  snapshot.design.kpis = [{ name: "Qualité", description: "Appréciation générale", unit: "qualitatif" }];
  const report = analyzeTemplateVersionQuality({ snapshot });
  const codes = new Set(report.warnings.map((item) => item.code));
  assert.ok(codes.has("TOO_MANY_OPEN_ACTIONS"));
  assert.ok(codes.has("MISSING_DEADLINE"));
  assert.ok(codes.has("MISSING_RESPONSIBLE_ACTOR"));
  assert.ok(codes.has("MISSING_EXPECTED_ACTION"));
  assert.ok(codes.has("MISSING_TARGET_ACTOR"));
  assert.ok(codes.has("NO_MEASURABLE_KPI"));
  assert.ok(codes.has("MISSING_EXIT_CONDITION"));
  assert.ok(report.improvementSuggestions.length > 0);
  assert.ok(report.overallQualityScore < 100);
});

test("reports the absence of relational requests even when documents exist", () => {
  const snapshot = completeSnapshot();
  snapshot.design.relationalRequests = [];
  snapshot.design.documents = [{ name: "Pièce d'identité", required: true, stage: 1 }];
  const report = analyzeTemplateVersionQuality({ snapshot });
  assert.equal(report.criticalIssues.some((item) => item.code === "MISSING_RELATIONAL_INPUT"), false);
  assert.ok(report.warnings.some((item) => item.code === "NO_RELATIONAL_REQUESTS"));
});
