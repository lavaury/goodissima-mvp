import assert from "node:assert/strict";
import test from "node:test";
import { experienceExamples, experienceGovernance, getFriendlyMergeWording, opportunityLifecycleLabels, transitionOpportunity, transitionRelationshipRequest } from "../lib/goodissima-experience.ts";

test("covers the French-first opportunity examples", () => {
  assert.equal(experienceExamples.length, 5);
  assert.ok(experienceExamples.includes("Je cherche un appartement"));
  assert.ok(experienceExamples.includes("Je recherche un partenaire"));
});

test("requires human confirmation for opportunity lifecycle transitions", () => {
  assert.throws(() => transitionOpportunity("DRAFT", "VALIDATED", false), /HUMAN_CONFIRMATION_REQUIRED/);
  assert.equal(transitionOpportunity("DRAFT", "VALIDATED", true), "VALIDATED");
  assert.equal(transitionOpportunity("VALIDATED", "PUBLISHED", true), "PUBLISHED");
  assert.equal(transitionOpportunity("PUBLISHED", "SUSPENDED", true), "SUSPENDED");
  assert.equal(transitionOpportunity("SUSPENDED", "PUBLISHED", true), "PUBLISHED");
  assert.equal(transitionOpportunity("PUBLISHED", "CLOSED", true), "CLOSED");
  assert.throws(() => transitionOpportunity("DRAFT", "PUBLISHED", true), /INVALID_OPPORTUNITY_TRANSITION/);
  assert.deepEqual(Object.values(opportunityLifecycleLabels), ["Brouillon", "Validée", "Publiée", "Suspendue", "Clôturée"]);
});

test("governs relationship request review and acceptance", () => {
  assert.equal(transitionRelationshipRequest("DRAFT", "PENDING_REVIEW", true), "PENDING_REVIEW");
  assert.equal(transitionRelationshipRequest("PENDING_REVIEW", "ACCEPTED", true), "ACCEPTED");
  assert.equal(transitionRelationshipRequest("PENDING_REVIEW", "DECLINED", true), "DECLINED");
  assert.throws(() => transitionRelationshipRequest("DRAFT", "ACCEPTED", true), /INVALID_RELATIONSHIP_REQUEST_TRANSITION/);
});

test("uses user-friendly merge wording outside debug", () => {
  assert.deepEqual(getFriendlyMergeWording({ explanations: ["Budget compatible"], weakCriteria: [] }), { strengths: ["Budget compatible"], attentionPoints: ["Aucun point faible identifié"] });
  assert.doesNotMatch(getFriendlyMergeWording({ explanations: [], weakCriteria: [] }).attentionPoints[0], /CIRO/);
});

test("keeps every automated governance capability disabled", () => {
  assert.deepEqual(experienceGovernance, {
    automaticPublication: false,
    automaticContact: false,
    automaticDecision: false,
    hiddenWorkflowExecution: false,
    humanValidationRequired: true,
    scoringEngine: "existing-merge",
  });
});
