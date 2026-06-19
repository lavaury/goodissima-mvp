import assert from "node:assert/strict";
import test from "node:test";
import { advanceTemplateDemo, initialTemplateDemoState, templateDemoStepNumber } from "../../lib/ai/template-demo-flow";

test("runs the seven guided demo steps in order", () => {
  let state = initialTemplateDemoState;
  state = advanceTemplateDemo(state, { type: "DRAFT_GENERATED", generationId: "generation-1" });
  state = advanceTemplateDemo(state, { type: "QUALITY_REVIEWED" });
  state = advanceTemplateDemo(state, { type: "DRAFT_V1_CREATED", templateId: "template-1", version: 1, isPublished: false });
  state = advanceTemplateDemo(state, { type: "VERSION_CRITIQUED", criticReportId: "critic-1" });
  state = advanceTemplateDemo(state, { type: "OPTIMIZATION_PROPOSED", optimizationId: "optimization-1" });
  state = advanceTemplateDemo(state, { type: "DRAFT_V2_CREATED", version: 2, isPublished: false });

  assert.equal(state.step, "DRAFT_V2_CREATED");
  assert.equal(templateDemoStepNumber(state.step), 7);
  assert.equal(state.version1?.isPublished, false);
  assert.equal(state.version2?.isPublished, false);
});

test("rejects skipped demo steps", () => {
  assert.throws(
    () => advanceTemplateDemo(initialTemplateDemoState, { type: "QUALITY_REVIEWED" }),
    /INVALID_DEMO_TRANSITION/,
  );
});

test("rejects published versions in the demo flow", () => {
  let state = advanceTemplateDemo(initialTemplateDemoState, { type: "DRAFT_GENERATED", generationId: "generation-1" });
  state = advanceTemplateDemo(state, { type: "QUALITY_REVIEWED" });
  assert.throws(
    () => advanceTemplateDemo(state, { type: "DRAFT_V1_CREATED", templateId: "template-1", version: 1, isPublished: true }),
    /INVALID_DEMO_DRAFT_V1/,
  );
});

test("reset removes all persisted identifiers from the client flow", () => {
  const state = advanceTemplateDemo(
    advanceTemplateDemo(initialTemplateDemoState, { type: "DRAFT_GENERATED", generationId: "generation-1" }),
    { type: "QUALITY_REVIEWED" },
  );
  assert.deepEqual(advanceTemplateDemo(state, { type: "RESET" }), initialTemplateDemoState);
});
