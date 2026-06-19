import { describeProposalChanges, type ProposalChangeSet } from "./ai/opportunity-refinement.ts";

export type JourneyActor = { name: string; role: string };
export type JourneyStage = { name: string; objective: string; expectedAction?: string; responsibleActor?: string; deadline?: string; exitCondition?: string };
export type JourneyDocument = { name: string; required: boolean; stage: number };
export type JourneyRequest = { title: string; description: string; stage: number; targetActor?: string; deadline?: string; status?: string };
export type JourneyKpi = { name: string; description: string; unit: string };

export type EditableJourneyDesign = {
  actors: JourneyActor[];
  stages: JourneyStage[];
  documents: JourneyDocument[];
  relationalRequests: JourneyRequest[];
  kpis: JourneyKpi[];
};

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stageNumber(value: unknown, stageCount: number) {
  const number = typeof value === "number" && Number.isInteger(value) ? value : 1;
  return Math.max(1, Math.min(number, Math.max(stageCount, 1)));
}

export function parseEditableJourneyDesign(value: unknown): EditableJourneyDesign {
  const design = record(value);
  const stages = (Array.isArray(design.stages) ? design.stages : []).map((value) => {
    const item = record(value);
    return { name: text(item.name), objective: text(item.objective), expectedAction: text(item.expectedAction) || undefined, responsibleActor: text(item.responsibleActor) || undefined, deadline: text(item.deadline) || undefined, exitCondition: text(item.exitCondition) || undefined };
  });
  return {
    actors: (Array.isArray(design.actors) ? design.actors : []).map((value) => { const item = record(value); return { name: text(item.name), role: text(item.role) }; }),
    stages,
    documents: (Array.isArray(design.documents) ? design.documents : []).map((value) => { const item = record(value); return { name: text(item.name), required: item.required === true, stage: stageNumber(item.stage, stages.length) }; }),
    relationalRequests: (Array.isArray(design.relationalRequests) ? design.relationalRequests : []).map((value) => { const item = record(value); return { title: text(item.title), description: text(item.description), stage: stageNumber(item.stage, stages.length), targetActor: text(item.targetActor) || undefined, deadline: text(item.deadline) || undefined, status: text(item.status) || undefined }; }),
    kpis: (Array.isArray(design.kpis) ? design.kpis : []).map((value) => { const item = record(value); return { name: text(item.name), description: text(item.description), unit: text(item.unit) }; }),
  };
}

export function addJourneyStage(design: EditableJourneyDesign): EditableJourneyDesign {
  return { ...design, stages: [...design.stages, { name: "Nouvelle étape", objective: "Décrire l'objectif de cette étape" }] };
}

export function updateJourneyStage(design: EditableJourneyDesign, index: number, patch: Partial<JourneyStage>): EditableJourneyDesign {
  return { ...design, stages: design.stages.map((stage, position) => position === index ? { ...stage, ...patch } : stage) };
}

export function deleteJourneyStage(design: EditableJourneyDesign, index: number): EditableJourneyDesign {
  const deletedStage = index + 1;
  const remap = (stage: number) => stage > deletedStage ? stage - 1 : Math.min(stage, Math.max(design.stages.length - 1, 1));
  return {
    ...design,
    stages: design.stages.filter((_, position) => position !== index),
    documents: design.documents.map((item) => ({ ...item, stage: remap(item.stage) })),
    relationalRequests: design.relationalRequests.map((item) => ({ ...item, stage: remap(item.stage) })),
  };
}

export function reorderJourneyStage(design: EditableJourneyDesign, from: number, to: number): EditableJourneyDesign {
  if (from === to || from < 0 || to < 0 || from >= design.stages.length || to >= design.stages.length) return design;
  const stages = [...design.stages];
  const [moved] = stages.splice(from, 1);
  stages.splice(to, 0, moved);
  const oldToNew = new Map<number, number>();
  design.stages.forEach((stage, oldIndex) => oldToNew.set(oldIndex + 1, stages.indexOf(stage) + 1));
  return {
    ...design,
    stages,
    documents: design.documents.map((item) => ({ ...item, stage: oldToNew.get(item.stage) ?? item.stage })),
    relationalRequests: design.relationalRequests.map((item) => ({ ...item, stage: oldToNew.get(item.stage) ?? item.stage })),
  };
}

export function manualJourneyChanges(previous: EditableJourneyDesign, current: EditableJourneyDesign): ProposalChangeSet {
  return describeProposalChanges(previous as unknown as Record<string, unknown>, current as unknown as Record<string, unknown>);
}

export function changedJourneyFields(changes: ProposalChangeSet) {
  return [...changes.added.map((value) => `added:${value}`), ...changes.modified.map((value) => `modified:${value}`), ...changes.removed.map((value) => `removed:${value}`)];
}

export function assertEditableDraftVersion(version: { isPublished: boolean; snapshot?: { metadata?: Record<string, unknown> } | null }) {
  if (version.isPublished) throw new Error("PUBLISHED_VERSION_PROTECTED");
  const lifecycle = version.snapshot?.metadata?.lifecycle;
  if (lifecycle && lifecycle !== "DRAFT") throw new Error("NON_DRAFT_VERSION_PROTECTED");
}

export function buildManualJourneyVersionPlan(input: {
  sourceVersion: { id: string; version: number; isPublished: boolean };
  newVersion: number;
  userId: string;
  sourceSnapshot: Record<string, unknown> & { metadata?: Record<string, unknown> };
  previousDesign: EditableJourneyDesign;
  design: EditableJourneyDesign;
  reason?: string | null;
  timestamp: string;
}) {
  assertEditableDraftVersion({ isPublished: input.sourceVersion.isPublished, snapshot: { metadata: input.sourceSnapshot.metadata } });
  const changes = manualJourneyChanges(input.previousDesign, input.design);
  const changedFields = changedJourneyFields(changes);
  if (changedFields.length === 0) throw new Error("NO_MANUAL_CHANGES");
  const audit = { userId: input.userId, sourceVersionId: input.sourceVersion.id, changeType: "MANUAL_JOURNEY_EDIT", changedFields, reason: input.reason ?? null, timestamp: input.timestamp };
  return {
    isPublished: false as const,
    changes,
    changedFields,
    audit,
    snapshot: {
      ...input.sourceSnapshot,
      design: input.design,
      metadata: {
        ...(input.sourceSnapshot.metadata ?? {}),
        snapshotVersion: 2,
        lifecycle: "DRAFT",
        manualEdit: { sourceVersion: input.sourceVersion.version, newVersion: input.newVersion, ...audit, changes, editedByUserId: input.userId, editedAt: input.timestamp, automaticPublication: false, automaticWorkflowExecution: false, automaticContact: false, activeRelationshipsModified: false },
      },
    },
  };
}
