import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateCiro } from "../src/ciro/validator.js";
import { evaluateMerge } from "../src/merge/candidate-evaluator.js";
import { loadScoringRules } from "../src/merge/loader.js";
import { validateFrenchMergeDemo } from "../src/presentation/demo-validator.js";
import { loadDemoMergeScenario, loadFrenchPresentationCatalog } from "../src/presentation/loader.js";
import { renderFrenchMergeDemo } from "../src/presentation/merge-demo.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "knowledge/presentation/presentation-catalog.fr.json");
const scenarioPath = path.join(root, "knowledge/demos/merge-housing/scenario.fr.json");
const employmentScenarioPath = path.join(root, "knowledge/demos/merge-employment/scenario.fr.json");
const scoringPath = path.join(root, "knowledge/merge/scoring-rules.v1.json");

test("French presentation catalog exposes the approved labels", async () => {
  const catalog = await loadFrenchPresentationCatalog(catalogPath);
  assert.equal(catalog.labels.PROPERTY_RENTAL, "Recherche de location");
  assert.equal(catalog.labels.TENANT, "Locataire");
  assert.equal(catalog.labels.LANDLORD, "Propriétaire");
  assert.equal(catalog.labels.CANDIDATE, "Candidat");
  assert.equal(catalog.labels.EMPLOYER, "Recruteur / employeur");
  assert.equal(catalog.labels.EXACT_MATCH, "Correspondance parfaite");
  assert.equal(catalog.labels.NO_MATCH, "Aucune correspondance");
});

test("employment demo contains candidate, employer, same-side candidate, and housing CIRO fixtures", async () => {
  const scenario = await loadDemoMergeScenario(employmentScenarioPath);
  const knownKnowledgeIds = new Set(["goodissima-trust-architecture", "goodissima-matching-governance"]);
  assert.equal(scenario.requester.presentationId, "CANDIDATE_SEARCH");
  assert.deepEqual(scenario.candidates.map((candidate) => candidate.presentationId), ["EMPLOYER", "CANDIDATE", "PROPERTY_RENTAL"]);
  for (const fixture of [scenario.requester, ...scenario.candidates]) {
    assert.equal(validateCiro(fixture.ciro, { knownKnowledgeIds }).valid, true);
  }
});

test("employment demo renders governed scores in French", async () => {
  const [catalog, scenario, scoring] = await Promise.all([
    loadFrenchPresentationCatalog(catalogPath),
    loadDemoMergeScenario(employmentScenarioPath),
    loadScoringRules(scoringPath),
  ]);
  const maximumScore = validateFrenchMergeDemo(scenario, catalog, scoring);
  const evaluated = evaluateMerge(scenario.requester.ciro, scenario.candidates.map((candidate) => candidate.ciro));
  assert.deepEqual(evaluated.map((candidate) => [candidate.candidateIndex, candidate.totalScore, candidate.status]), [
    [0, 4, "EXACT_MATCH"],
    [1, 2, "RELATED_OPPORTUNITY"],
    [2, 0, "NO_MATCH"],
  ]);
  const output = renderFrenchMergeDemo(scenario, catalog, maximumScore);
  assert.match(output, /Demandeur :\nCandidat recherchant un emploi/);
  assert.match(output, /1\. Recruteur \/ employeur\n   Correspondance parfaite\n   Score relationnel : 100 %/);
  assert.match(output, /2\. Candidat\n   Opportunité pertinente\n   Score relationnel : 50 %/);
  assert.match(output, /3\. Recherche de location\n   Aucune correspondance/);
});

test("housing demo contains four valid source-governed CIRO fixtures", async () => {
  const scenario = await loadDemoMergeScenario(scenarioPath);
  const knownKnowledgeIds = new Set(["goodissima-trust-architecture", "goodissima-matching-governance"]);
  assert.equal(scenario.candidates.length + 1, 4);
  for (const fixture of [scenario.requester, ...scenario.candidates]) {
    assert.equal(validateCiro(fixture.ciro, { knownKnowledgeIds }).valid, true);
  }
});

test("French demo renders existing evaluator results without changing scores", async () => {
  const [catalog, scenario, scoring] = await Promise.all([
    loadFrenchPresentationCatalog(catalogPath),
    loadDemoMergeScenario(scenarioPath),
    loadScoringRules(scoringPath),
  ]);
  const maximumScore = Object.values(scoring.dimensions).reduce((sum, dimension) => sum + dimension.score, 0);
  const evaluated = evaluateMerge(scenario.requester.ciro, scenario.candidates.map((candidate) => candidate.ciro));
  assert.deepEqual(evaluated.map((candidate) => [candidate.candidateIndex, candidate.totalScore, candidate.status]), [
    [0, 4, "EXACT_MATCH"],
    [1, 1, "WEAK_SIGNAL"],
    [2, 0, "NO_MATCH"],
  ]);

  const output = renderFrenchMergeDemo(scenario, catalog, maximumScore);
  assert.match(output, /Demandeur :\nLocataire recherchant une location/);
  assert.match(output, /1\. Propriétaire\n   Correspondance parfaite\n   Score relationnel : 100 %/);
  assert.match(output, /2\. Locataire\n   Compatibilité faible\n   Score relationnel : 25 %/);
  assert.match(output, /3\. Recherche d'emploi\n   Aucune correspondance/);
  assert.match(output, /✓ Même relation/);
  assert.match(output, /✗ Rôles non compatibles selon le score/);
});

test("French demo validation rejects an ungoverned fixture source", async () => {
  const [catalog, scenario, scoring] = await Promise.all([
    loadFrenchPresentationCatalog(catalogPath),
    loadDemoMergeScenario(scenarioPath),
    loadScoringRules(scoringPath),
  ]);
  const invalid = structuredClone(scenario);
  invalid.candidates[0].ciro.sources = [{ knowledgeId: "unknown-demo-source" }];
  assert.throws(
    () => validateFrenchMergeDemo(invalid, catalog, scoring),
    /Unknown knowledge source/,
  );
});
