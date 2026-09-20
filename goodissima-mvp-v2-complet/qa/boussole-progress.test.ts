import assert from "node:assert/strict";
import test from "node:test";
import { createBoussoleProgress, parseBoussoleProgressStore, resolveBoussoleProgress } from "../lib/boussole/progress.ts";

const steps = ["step-a", "step-b"];

test("resumes the same journey version by stable stepId", () => {
  const raw = JSON.stringify({ progressions: { guide: createBoussoleProgress({ pageId: "page", journeyId: "guide", journeyVersion: 2, stepId: "step-b" }) }, notifiedVersions: {} });
  const result = resolveBoussoleProgress({ raw, pageId: "page", journeyId: "guide", journeyVersion: 2, validStepIds: steps });
  assert.equal(result.stepId, "step-b");
  assert.equal(result.guideUpdated, false);
});

test("resets only the changed journey and shows its update once", () => {
  const other = createBoussoleProgress({ pageId: "page", journeyId: "other", journeyVersion: 3, stepId: "other-step" });
  const raw = JSON.stringify({ progressions: { guide: createBoussoleProgress({ pageId: "page", journeyId: "guide", journeyVersion: 1, stepId: "step-b" }), other }, notifiedVersions: {} });
  const first = resolveBoussoleProgress({ raw, pageId: "page", journeyId: "guide", journeyVersion: 2, validStepIds: steps });
  assert.equal(first.stepId, "step-a");
  assert.equal(first.guideUpdated, true);
  assert.deepEqual(first.store.progressions.other, other);
  const second = resolveBoussoleProgress({ raw: JSON.stringify(first.store), pageId: "page", journeyId: "guide", journeyVersion: 2, validStepIds: steps });
  assert.equal(second.guideUpdated, false);
});

test("falls back safely when a stable step disappeared", () => {
  const raw = JSON.stringify({ progressions: { guide: createBoussoleProgress({ pageId: "page", journeyId: "guide", journeyVersion: 2, stepId: "removed-step" }) }, notifiedVersions: {} });
  const result = resolveBoussoleProgress({ raw, pageId: "page", journeyId: "guide", journeyVersion: 2, validStepIds: steps });
  assert.equal(result.stepId, "step-a");
  assert.equal(result.missingStepId, "removed-step");
});

test("does not resume or persist when resume is disabled", () => {
  const saved = createBoussoleProgress({ pageId: "page", journeyId: "guide", journeyVersion: 2, stepId: "step-b" });
  const raw = JSON.stringify({ progressions: { guide: saved }, notifiedVersions: {} });
  const result = resolveBoussoleProgress({ raw, pageId: "page", journeyId: "guide", journeyVersion: 2, validStepIds: steps, resume: false });
  assert.equal(result.stepId, "step-a");
  assert.equal(result.shouldPersist, false);
  assert.deepEqual(result.store.progressions.guide, saved);
});

test("falls back to the first applicable step when the saved step is invisible", () => {
  const raw = JSON.stringify({ progressions: { guide: createBoussoleProgress({ pageId: "page", journeyId: "guide", journeyVersion: 2, stepId: "step-a" }) }, notifiedVersions: {} });
  const result = resolveBoussoleProgress({ raw, pageId: "page", journeyId: "guide", journeyVersion: 2, validStepIds: ["step-b"] });
  assert.equal(result.stepId, "step-b");
});

test("resumes A and B independently across A/B/A navigation", () => {
  const raw = JSON.stringify({ progressions: {
    A: createBoussoleProgress({ pageId: "page", journeyId: "A", journeyVersion: 1, stepId: "a-4" }),
    B: createBoussoleProgress({ pageId: "page", journeyId: "B", journeyVersion: 1, stepId: "b-2" }),
  }, notifiedVersions: {} });
  const a1 = resolveBoussoleProgress({ raw, pageId: "page", journeyId: "A", journeyVersion: 1, validStepIds: ["a-1", "a-4"] });
  const b = resolveBoussoleProgress({ raw: JSON.stringify(a1.store), pageId: "page", journeyId: "B", journeyVersion: 1, validStepIds: ["b-1", "b-2"] });
  const a2 = resolveBoussoleProgress({ raw: JSON.stringify(b.store), pageId: "page", journeyId: "A", journeyVersion: 1, validStepIds: ["a-1", "a-4"] });
  assert.deepEqual([a1.stepId, b.stepId, a2.stepId], ["a-4", "b-2", "a-4"]);
});

test("migrates the legacy index and ignores corrupted JSON", () => {
  const migrated = resolveBoussoleProgress({ raw: JSON.stringify({ sequenceId: "guide", stepIndex: 1 }), pageId: "page", journeyId: "guide", journeyVersion: 1, validStepIds: steps, legacyStepIndex: 1 });
  assert.equal(migrated.stepId, "step-b");
  assert.deepEqual(parseBoussoleProgressStore("{broken"), { progressions: {}, notifiedVersions: {} });
});

test("keeps general preferences outside progression changes", () => {
  const preferences = { level: "autonomous", speech: "manual", text: "detailed", rate: 1.05, reducedMotion: true, resume: true, goals: ["understand"] };
  const before = JSON.stringify(preferences);
  resolveBoussoleProgress({ raw: "{broken", pageId: "page", journeyId: "guide", journeyVersion: 1, validStepIds: steps });
  assert.equal(JSON.stringify(preferences), before);
});

test("preserves an unavailable journey and stores identifiers only", () => {
  const focused = createBoussoleProgress({ pageId: "cockpit", journeyId: "focused-guide", journeyVersion: 1, stepId: "focused-step" });
  const raw = JSON.stringify({ progressions: { "focused-guide": focused }, notifiedVersions: {} });
  const empty = resolveBoussoleProgress({ raw, pageId: "cockpit", journeyId: "empty-guide", journeyVersion: 1, validStepIds: ["empty-step"] });
  assert.deepEqual(empty.store.progressions["focused-guide"], focused);
  assert.deepEqual(Object.keys(empty.store.progressions["empty-guide"]), ["pageId", "journeyId", "journeyVersion", "stepId", "updatedAt"]);
  assert.doesNotMatch(JSON.stringify(empty.store), /email|token|secure|message|document|candidate/i);
});
