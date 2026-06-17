export const templateDemoSteps = [
  "NEED_DESCRIPTION",
  "DRAFT_GENERATED",
  "QUALITY_REVIEWED",
  "DRAFT_V1_CREATED",
  "VERSION_CRITIQUED",
  "OPTIMIZATION_PROPOSED",
  "DRAFT_V2_CREATED",
] as const;

export type TemplateDemoStep = (typeof templateDemoSteps)[number];

export type TemplateDemoState = {
  step: TemplateDemoStep;
  generationId?: string;
  templateId?: string;
  criticReportId?: string;
  optimizationId?: string;
  version1?: { version: number; isPublished: boolean };
  version2?: { version: number; isPublished: boolean };
};

export type TemplateDemoEvent =
  | { type: "DRAFT_GENERATED"; generationId: string }
  | { type: "QUALITY_REVIEWED" }
  | { type: "DRAFT_V1_CREATED"; templateId: string; version: number; isPublished: boolean }
  | { type: "VERSION_CRITIQUED"; criticReportId: string }
  | { type: "OPTIMIZATION_PROPOSED"; optimizationId: string }
  | { type: "DRAFT_V2_CREATED"; version: number; isPublished: boolean }
  | { type: "RESET" };

export const initialTemplateDemoState: TemplateDemoState = { step: "NEED_DESCRIPTION" };

export function advanceTemplateDemo(state: TemplateDemoState, event: TemplateDemoEvent): TemplateDemoState {
  if (event.type === "RESET") return initialTemplateDemoState;

  if (state.step === "NEED_DESCRIPTION" && event.type === "DRAFT_GENERATED") {
    return { ...state, step: "DRAFT_GENERATED", generationId: event.generationId };
  }
  if (state.step === "DRAFT_GENERATED" && event.type === "QUALITY_REVIEWED") {
    return { ...state, step: "QUALITY_REVIEWED" };
  }
  if (state.step === "QUALITY_REVIEWED" && event.type === "DRAFT_V1_CREATED") {
    if (event.isPublished || event.version !== 1) throw new Error("INVALID_DEMO_DRAFT_V1");
    return {
      ...state,
      step: "DRAFT_V1_CREATED",
      templateId: event.templateId,
      version1: { version: event.version, isPublished: event.isPublished },
    };
  }
  if (state.step === "DRAFT_V1_CREATED" && event.type === "VERSION_CRITIQUED") {
    return { ...state, step: "VERSION_CRITIQUED", criticReportId: event.criticReportId };
  }
  if (state.step === "VERSION_CRITIQUED" && event.type === "OPTIMIZATION_PROPOSED") {
    return { ...state, step: "OPTIMIZATION_PROPOSED", optimizationId: event.optimizationId };
  }
  if (state.step === "OPTIMIZATION_PROPOSED" && event.type === "DRAFT_V2_CREATED") {
    if (event.isPublished || event.version !== 2) throw new Error("INVALID_DEMO_DRAFT_V2");
    return { ...state, step: "DRAFT_V2_CREATED", version2: { version: event.version, isPublished: event.isPublished } };
  }

  throw new Error(`INVALID_DEMO_TRANSITION:${state.step}:${event.type}`);
}

export function templateDemoStepNumber(step: TemplateDemoStep) {
  return templateDemoSteps.indexOf(step) + 1;
}
