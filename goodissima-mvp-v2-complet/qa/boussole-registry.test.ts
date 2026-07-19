import assert from "node:assert/strict";
import test from "node:test";
import { governanceSequences } from "../lib/boussole-governance.ts";
import { governedJourneySequences } from "../lib/boussole-governed-journey.ts";
import { newGovernedJourneySequences } from "../lib/boussole-new-governed-journey.ts";
import {
  boussoleRegistry,
  formatBoussoleIntegrityIssue,
  validateBoussoleRegistry,
} from "../lib/boussole/registry.ts";
import { resolveBoussolePageState } from "../lib/boussole/page-state.ts";

test("resolves EMPTY, POPULATED and FOCUSED deterministically", () => {
  assert.equal(resolveBoussolePageState({ focusedObjectId: "real-object", visibleObjectCount: 0 }), "FOCUSED");
  assert.equal(resolveBoussolePageState({ visibleObjectCount: 2 }), "POPULATED");
  assert.equal(resolveBoussolePageState({ visibleObjectCount: 0 }), "EMPTY");
});

test("validates the central Boussole registry", () => {
  const errors = validateBoussoleRegistry();
  assert.deepEqual(errors.map(formatBoussoleIntegrityIssue), []);
});

test("registers the three real sources without duplicating their steps", () => {
  const expected = [governanceSequences, newGovernedJourneySequences, governedJourneySequences];
  assert.equal(boussoleRegistry.length, expected.length);
  for (const [pageIndex, entry] of boussoleRegistry.entries()) {
    assert.deepEqual(entry.manifest.journeyIds, expected[pageIndex].map((journey) => journey.id));
    for (const [journeyIndex, journey] of entry.journeys.entries()) {
      assert.equal(journey.steps, expected[pageIndex][journeyIndex].steps);
    }
  }
});

test("declares real page states and typed first-visible strategies", () => {
  assert.deepEqual(governedJourneySequences.flatMap((journey) => journey.applicableStates ?? []), Array(6).fill("FOCUSED"));
  assert.ok(governanceSequences.find((journey) => journey.id === "understand-governance")?.applicableStates?.includes("EMPTY"));
  const strategies = governanceSequences.flatMap((journey) => journey.steps).map((step) => step.targetStrategy).filter(Boolean);
  assert.deepEqual(new Set(strategies.map((strategy) => strategy!.kind)), new Set(["FIRST_VISIBLE_MATCH"]));
  assert.deepEqual(new Set(strategies.map((strategy) => strategy!.objectType)), new Set(["WORKSPACE", "PORTFOLIO", "GOVERNED_JOURNEY", "RELATION_CASE"]));
});

test("reports page, journey, step and invalid reference", () => {
  const source = boussoleRegistry[0];
  const invalid = {
    manifest: { ...source.manifest, targets: source.manifest.targets.filter((target) => target !== source.journeys[0].steps[0].targetId) },
    journeys: source.journeys,
  };
  const message = formatBoussoleIntegrityIssue(validateBoussoleRegistry([invalid])[0]);
  assert.match(message, /page=governance/);
  assert.match(message, /parcours=understand-governance/);
  assert.match(message, /étape=governance-page/);
  assert.match(message, /référence=governance-overview/);
});
