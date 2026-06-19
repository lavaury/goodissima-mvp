import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTemplateVersionQuality } from "../../lib/ai/template-critic";
import { generateTemplateOptimizationProposal } from "../../lib/ai/template-optimizer";

function deficientSnapshot(): Record<string, any> {
  return {
    relationTemplate: { id: "template-1", key: "PARTENAIRE", name: "Parcours partenaire", description: null },
    formTemplate: { id: "form-1", key: "PARTENAIRE_FORM", name: "Parcours partenaire", description: null },
    fields: [{ key: "nom", label: "Nom complet", type: "TEXT", required: true, step: 1 }],
    design: {
      actors: [{ name: "Responsable", role: "Valide le dossier" }],
      stages: [{ name: "Collecte", objective: "Collecter les pièces" }],
      documents: [],
      relationalRequests: [],
      kpis: [{ name: "Qualité", description: "Appréciation générale", unit: "qualitatif" }],
    },
    metadata: { snapshotVersion: 2 },
  };
}

test("generates an explained French proposal without mutating the source", () => {
  const snapshot = deficientSnapshot();
  const before = structuredClone(snapshot);
  const criticReport = analyzeTemplateVersionQuality({ snapshot, analyzedAt: "2026-06-14T12:00:00.000Z" });
  const proposal = generateTemplateOptimizationProposal({ snapshot, criticReport, generatedAt: "2026-06-14T12:05:00.000Z" });

  assert.deepEqual(snapshot, before);
  assert.equal(proposal.language, "fr");
  assert.equal(proposal.originalScore, criticReport.overallQualityScore);
  assert.ok(proposal.projectedScore > proposal.originalScore);
  assert.ok(proposal.changes.length > 0);
  assert.ok(proposal.changes.every((change) => change.explanation.length > 0 && change.sourceIssueCode.length > 0));
});

test("adds governance details only to the optimization snapshot", () => {
  const snapshot = deficientSnapshot();
  const criticReport = analyzeTemplateVersionQuality({ snapshot });
  const proposal = generateTemplateOptimizationProposal({ snapshot, criticReport });
  const design = proposal.optimizedSnapshot.design as Record<string, any>;

  assert.equal(snapshot.design.stages[0].deadline, undefined);
  assert.equal(typeof design.stages[0].deadline, "string");
  assert.equal(typeof design.stages[0].responsibleActor, "string");
  assert.equal(typeof design.stages[0].expectedAction, "string");
  assert.equal(typeof design.stages[0].exitCondition, "string");
  assert.equal(design.relationalRequests.length, 1);
  assert.ok(design.kpis.some((kpi: Record<string, unknown>) => kpi.unit === "jours"));
});

test("keeps unsafe structural choices as unresolved suggestions", () => {
  const snapshot = deficientSnapshot();
  snapshot.design.stages = Array.from({ length: 9 }, (_, index) => ({
    name: `Étape ${index + 1}`,
    objective: "Traiter le dossier",
    expectedAction: "Relire",
    responsibleActor: "Responsable",
    deadline: "Sous 2 jours",
    exitCondition: "Validation humaine",
  }));
  const criticReport = analyzeTemplateVersionQuality({ snapshot });
  const proposal = generateTemplateOptimizationProposal({ snapshot, criticReport });

  assert.equal((proposal.optimizedSnapshot.design as Record<string, any>).stages.length, 9);
  assert.ok(proposal.unresolvedSuggestions.some((item) => item.code === "IMPROVE_TOO_MANY_STAGES"));
});

test("produces no silent changes for an already complete version", () => {
  const snapshot = deficientSnapshot();
  snapshot.design.stages[0] = {
    ...snapshot.design.stages[0],
    expectedAction: "Relire",
    responsibleActor: "Responsable",
    deadline: "Sous 2 jours",
    exitCondition: "Validation humaine",
  };
  snapshot.design.relationalRequests = [{ title: "Validation", description: "Valider", stage: 1, targetActor: "Responsable", deadline: "Sous 2 jours", status: "OPEN" }];
  snapshot.design.kpis = [{ name: "Délai", description: "Temps avant validation", unit: "jours" }];
  const criticReport = analyzeTemplateVersionQuality({ snapshot });
  const proposal = generateTemplateOptimizationProposal({ snapshot, criticReport });

  assert.equal(criticReport.overallQualityScore, 100);
  assert.deepEqual(proposal.changes, []);
  assert.equal(proposal.projectedScore, 100);
});
