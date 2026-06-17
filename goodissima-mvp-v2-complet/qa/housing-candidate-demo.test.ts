import assert from "node:assert/strict";
import test from "node:test";
import { scoreMerge } from "../goodissima-intent-engine/dist/src/merge/scoring-engine.js";
import { housingDemoScoringContract, housingRentalOffer, rankHousingCandidates } from "../lib/housing-candidate-demo.ts";
import { createHousingRelationRequestDraft, filterHousingCandidates, getHousingCandidateDebugDetails } from "../lib/housing-candidate-demo-client.ts";

test("ranks twenty fictional certified candidates with the requested distribution", () => {
  const candidates = rankHousingCandidates();
  assert.equal(candidates.length, 20);
  assert.ok(candidates.every((candidate) => candidate.certificationStatus === "CERTIFIÉ"));
  assert.deepEqual(candidates.map((candidate) => candidate.matchScore), [...candidates.map((candidate) => candidate.matchScore)].sort((a, b) => b - a));
  const count = (band: string) => candidates.filter((candidate) => candidate.band === band).length;
  assert.deepEqual({ excellent: count("EXCELLENT"), strong: count("STRONG"), opportunity: count("OPPORTUNITY"), weak: count("WEAK"), hidden: count("NO_MATCH") }, { excellent: 3, strong: 5, opportunity: 6, weak: 4, hidden: 2 });
});

test("filters candidates and hides NO_MATCH by default", () => {
  const candidates = rankHousingCandidates();
  assert.equal(filterHousingCandidates(candidates, "ALL").length, 18);
  assert.equal(filterHousingCandidates(candidates, "ALL", true).length, 20);
  assert.equal(filterHousingCandidates(candidates, "EXCELLENT").length, 3);
  assert.ok(filterHousingCandidates(candidates, "WEAK").every((candidate) => candidate.band === "WEAK"));
});

test("creates a local relation request draft without external side effects", () => {
  const candidate = rankHousingCandidates()[0];
  const draft = createHousingRelationRequestDraft(housingRentalOffer, candidate);
  assert.equal(draft.sourceActor, housingRentalOffer.landlordDisplayName);
  assert.equal(draft.targetCandidate, candidate.displayName);
  assert.equal(draft.offer, housingRentalOffer.title);
  assert.equal(draft.matchScore, candidate.matchScore);
  assert.equal(draft.status, "DRAFT");
  assert.throws(() => createHousingRelationRequestDraft(housingRentalOffer, rankHousingCandidates().at(-1)!), /NO_MATCH_CONTACT_PROHIBITED/);
});

test("exposes CIRO and score breakdown only in debug mode", () => {
  const candidate = rankHousingCandidates()[0];
  assert.equal(getHousingCandidateDebugDetails(candidate, false), null);
  const debug = getHousingCandidateDebugDetails(candidate, true);
  assert.deepEqual(debug?.ciro, candidate.ciro);
  assert.equal(debug?.scoreBreakdown.totalScore, 4);
  assert.equal(debug?.engineStatus, "EXACT_MATCH");
});

test("uses the existing merge scorer without modifying score logic", () => {
  const candidates = rankHousingCandidates();
  assert.equal(housingDemoScoringContract.engine, "evaluateMerge");
  assert.equal(housingDemoScoringContract.maximumScore, 4);
  for (const candidate of candidates) {
    const direct = scoreMerge(housingRentalOffer.ciro, candidate.ciro);
    assert.deepEqual(candidate.scoreBreakdown, {
      relationshipScore: direct.relationshipScore,
      roleScore: direct.roleScore,
      trustScore: direct.trustScore,
      familyScore: direct.familyScore,
      totalScore: direct.totalScore,
    });
    assert.equal(candidate.matchStatus, direct.status);
  }
});
