import assert from "node:assert/strict";
import test from "node:test";
import { appendProposalVersion, canValidateProposalVersion, createProposalRevision, describeProposalChanges, previousProposalVersion, type ProposalVersion } from "../lib/ai/opportunity-refinement.ts";

type Draft = { description: string; actors: Array<{ name: string }>; stages: Array<{ name: string }> };
type Version = ProposalVersion<Draft, { valid: boolean }>;

const v1: Version = { generationId: "gen-1", version: 1, draft: { description: "Location simple", actors: [{ name: "Candidat" }, { name: "Garant" }], stages: [] }, validation: { valid: true }, changes: { added: [], modified: [], removed: [] } };

test("creates a revision from the current proposal instead of replacing history", () => {
  const history = createProposalRevision([v1], { sourceGenerationId: "gen-1", generationId: "gen-2", draft: { ...v1.draft, stages: [{ name: "Vérification des revenus" }] }, validation: { valid: true }, feedback: "Ajoute une étape de vérification des revenus." });
  assert.equal(history.length, 2);
  assert.equal(history[0], v1);
  assert.equal(history[1].version, 2);
  assert.deepEqual(history[1].changes.added, ["Étapes : Vérification des revenus"]);
});

test("keeps monotonically versioned proposal history", () => {
  const v2 = appendProposalVersion([v1], { generationId: "gen-2", draft: v1.draft, validation: { valid: true }, changes: { added: [], modified: [], removed: [] } });
  const v3 = appendProposalVersion(v2, { generationId: "gen-3", draft: v1.draft, validation: { valid: true }, changes: { added: [], modified: [], removed: [] } });
  assert.deepEqual(v3.map((item) => `Proposition v${item.version}`), ["Proposition v1", "Proposition v2", "Proposition v3"]);
});

test("displays additions, modifications and removals", () => {
  const changes = describeProposalChanges(v1.draft, { description: "Location rassurante", actors: [{ name: "Candidat" }], stages: [{ name: "Certification" }] });
  assert.deepEqual(changes.added, ["Étapes : Certification"]);
  assert.deepEqual(changes.modified, ["Description"]);
  assert.deepEqual(changes.removed, ["Acteurs : Garant"]);
});

test("rolls back to the previous proposal without deleting audit history", () => {
  const history = appendProposalVersion([v1], { generationId: "gen-2", draft: { ...v1.draft, actors: [{ name: "Candidat" }] }, validation: { valid: true }, changes: { added: [], modified: [], removed: ["Acteurs : Garant"] } });
  assert.equal(previousProposalVersion(history)?.generationId, "gen-1");
  assert.equal(history.length, 2);
});

test("requires explicit human validation of a known version", () => {
  const history = [{ generationId: "gen-1" }, { generationId: "gen-2" }];
  assert.equal(canValidateProposalVersion(history, "gen-1", true), true);
  assert.equal(canValidateProposalVersion(history, "gen-2", false), false);
  assert.equal(canValidateProposalVersion(history, "unknown", true), false);
});
