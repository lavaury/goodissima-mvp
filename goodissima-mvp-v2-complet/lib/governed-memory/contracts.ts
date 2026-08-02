import type {
  GovernedMemoryDecisionId, GovernedMemoryDispute, GovernedMemoryFact,
  GovernedMemoryFactId, GovernedMemoryObjectRef, GovernedMemoryScope, GovernedMemorySourceId,
  GovernedMemorySynthesis, GovernedMemorySynthesisId, GovernedMemoryValidationDecision,
  GovernedMemoryVisibility, RelationCaseId, UserId,
} from "./types";

export type GetMemoryStateAtInput = { relationCaseId: RelationCaseId; at: string; requesterUserId: UserId };
export type CompareMemoryPeriodsInput = { relationCaseId: RelationCaseId; from: string; to: string; requesterUserId: UserId };
export type ExplainDecisionInput = { relationCaseId: RelationCaseId; decisionId: GovernedMemoryDecisionId; at: string; requesterUserId: UserId };
export type ReconstructAccessInput = { relationCaseId: RelationCaseId; subjectUserId: UserId; at: string; requesterUserId: UserId };
export type ValidateSynthesisInput = { relationCaseId: RelationCaseId; synthesisId: GovernedMemorySynthesisId; validatorUserId: UserId; decision: GovernedMemoryValidationDecision; rationale: string; reservations: readonly string[] };
export type ProposeFactInput = Pick<GovernedMemoryFact, "scope" | "statement" | "authorUserId" | "authorRepresentationId" | "effectiveFrom" | "effectiveUntil" | "sourceRefs" | "visibility">;
export type EstablishFactInput = { relationCaseId: RelationCaseId; factId: GovernedMemoryFactId; establishedByUserId: UserId; establishedAt: string; rationale: string; sourceRefs: readonly GovernedMemorySourceId[] };
export type DisputeMemoryObjectInput = Pick<GovernedMemoryDispute, "scope" | "targetType" | "targetId" | "raisedByUserId" | "raisedAt" | "reason" | "sourceRefs">;

export type GovernedMemoryTimelineEntry = { at: string; summary: string; objectRefs: readonly GovernedMemoryObjectRef[] };
export type GovernedMemorySourceCitation = { sourceId: GovernedMemorySourceId; title: string; available: boolean; redacted: boolean };
export type GovernedMemoryAccessRedaction = { objectType: string; reasonCode: "CURRENT_ACCESS_DENIED" | "SOURCE_RESTRICTED" | "SOURCE_UNAVAILABLE"; description: string };

export type GovernedMemoryAnswer = {
  summary: string;
  establishedFacts: readonly GovernedMemoryFact[];
  decisions: readonly GovernedMemoryDecisionId[];
  timeline: readonly GovernedMemoryTimelineEntry[];
  inferences: GovernedMemorySynthesis["inferences"];
  limitations: GovernedMemorySynthesis["limitations"];
  sources: readonly GovernedMemorySourceCitation[];
  validationStatus: "UNVALIDATED" | "PARTIALLY_VALIDATED" | "VALIDATED" | "DISPUTED";
  accessRedactions: readonly GovernedMemoryAccessRedaction[];
};

export type ScopedConceptInput = { scope: GovernedMemoryScope; visibility: GovernedMemoryVisibility };
