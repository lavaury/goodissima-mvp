export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type GovernedMemoryFactId = Brand<string, "GovernedMemoryFactId">;
export type GovernedMemoryDecisionId = Brand<string, "GovernedMemoryDecisionId">;
export type GovernedMemorySourceId = Brand<string, "GovernedMemorySourceId">;
export type GovernedMemoryEventId = Brand<string, "GovernedMemoryEventId">;
export type GovernedMemoryAccessGrantId = Brand<string, "GovernedMemoryAccessGrantId">;
export type GovernedMemorySynthesisId = Brand<string, "GovernedMemorySynthesisId">;
export type GovernedMemoryValidationId = Brand<string, "GovernedMemoryValidationId">;
export type GovernedMemoryDisputeId = Brand<string, "GovernedMemoryDisputeId">;
export type RelationCaseId = Brand<string, "RelationCaseId">;
export type UserId = Brand<string, "UserId">;
export type RepresentationId = Brand<string, "RepresentationId">;

export type GovernedMemoryScopeType = "RELATION_CASE";
export type GovernedMemoryScope = { type: GovernedMemoryScopeType; relationCaseId: RelationCaseId };

export const GOVERNED_MEMORY_VISIBILITIES = [
  "CASE_PARTICIPANTS", "MEMORY_STEWARDS", "SPECIFIC_SUBJECTS", "PRIVATE_TO_AUTHOR", "RESTRICTED",
] as const;
export type GovernedMemoryVisibilityKind = (typeof GOVERNED_MEMORY_VISIBILITIES)[number];
export type GovernedMemoryVisibility = {
  kind: GovernedMemoryVisibilityKind;
  subjectUserIds?: readonly UserId[];
  subjectRepresentationIds?: readonly RepresentationId[];
  policyRef?: string;
};

export type GovernedMemoryTemporal = {
  recordedAt: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  supersededAt?: string | null;
};

export type GovernedMemoryObjectType = "FACT" | "DECISION" | "SOURCE" | "EVENT" | "ACCESS_GRANT" | "SYNTHESIS" | "VALIDATION" | "DISPUTE";
export type GovernedMemoryObjectRef = { type: GovernedMemoryObjectType; id: string; scope: GovernedMemoryScope };

export type GovernedMemoryFactStatus = "PROPOSED" | "ESTABLISHED" | "DISPUTED" | "SUPERSEDED";
export type GovernedMemoryEvidenceLevel = "DECLARED" | "SUPPORTED" | "CORROBORATED" | "CONTESTED";
export type GovernedMemoryFact = GovernedMemoryTemporal & {
  id: GovernedMemoryFactId;
  scope: GovernedMemoryScope;
  statement: string;
  status: GovernedMemoryFactStatus;
  evidenceLevel: GovernedMemoryEvidenceLevel;
  authorUserId: UserId;
  authorRepresentationId: RepresentationId | null;
  sourceRefs: readonly GovernedMemorySourceId[];
  establishedByUserId: UserId | null;
  establishedAt: string | null;
  supersedesFactId: GovernedMemoryFactId | null;
  supersededByFactId: GovernedMemoryFactId | null;
  disputeRefs: readonly GovernedMemoryDisputeId[];
  visibility: GovernedMemoryVisibility;
  evidenceNote: "DOCUMENTED" | "ESTABLISHED_WITHOUT_DOCUMENTARY_EVIDENCE";
};

export type GovernedMemoryDecisionStatus = "DRAFT" | "VALIDATED" | "SUPERSEDED" | "CANCELLED";
export type GovernedMemoryDecisionRelationType = "REPLACES" | "CANCELS" | "CORRECTS" | "COMPLEMENTS";
export type GovernedMemoryDecision = GovernedMemoryTemporal & {
  id: GovernedMemoryDecisionId;
  scope: GovernedMemoryScope;
  title: string;
  rationale: string;
  status: GovernedMemoryDecisionStatus;
  decidedByUserId: UserId;
  validatedByUserId: UserId | null;
  decidedAt: string;
  sourceRefs: readonly GovernedMemorySourceId[];
  factRefs: readonly GovernedMemoryFactId[];
  priorDecisionRefs: readonly { decisionId: GovernedMemoryDecisionId; relation: GovernedMemoryDecisionRelationType }[];
  consequences: readonly string[];
  reservations: readonly string[];
  visibility: GovernedMemoryVisibility;
  validationState: "UNVALIDATED" | "VALIDATED" | "VALIDATED_WITH_RESERVATIONS";
  evidenceNote: "DOCUMENTED" | "DECIDED_WITHOUT_DOCUMENTARY_SOURCE";
};

export type GovernedMemorySourceKind = "DOCUMENT" | "DOCUMENT_VERSION" | "FORM_SUBMISSION" | "MESSAGE_EXCERPT" | "SYSTEM_EVENT" | "HUMAN_DECLARATION" | "VALIDATED_SYNTHESIS" | "EXTERNAL_IMPORT";
export type GovernedMemorySourceStatus = "ACTIVE" | "ARCHIVED" | "RESTRICTED" | "EXPIRED" | "ANONYMIZED" | "DELETED" | "LEGAL_HOLD";
export type GovernedMemorySource = {
  id: GovernedMemorySourceId;
  scope: GovernedMemoryScope;
  kind: GovernedMemorySourceKind;
  status: GovernedMemorySourceStatus;
  sourceObjectType: string;
  sourceObjectId: string;
  title: string;
  authoredAt: string | null;
  receivedAt: string | null;
  recordedAt: string;
  promotedByUserId: UserId | null;
  promotedAt: string | null;
  visibility: GovernedMemoryVisibility;
  integrityRef: string | null;
  versionRef: string | null;
  retentionPolicyRef: string | null;
  unavailableReason: string | null;
  externalOrigin: string | null;
  primarySourceRefs: readonly GovernedMemorySourceId[];
};

export type GovernedMemoryConsentBasis =
  | { type: "AUTHOR_PROMOTED_OWN_MESSAGE" }
  | { type: "EXPLICIT_AUTHOR_CONSENT"; evidenceRef: string }
  | { type: "DOCUMENTED_GOVERNANCE_AUTHORITY"; authorityRef: string }
  | { type: "DOCUMENTED_LEGAL_OBLIGATION"; obligationRef: string };

export type PromotePrivateMessageExcerptInput = {
  relationCaseId: RelationCaseId;
  messageId: string;
  excerpt: string;
  visibility: GovernedMemoryVisibility;
  purpose: string;
  consentBasis: GovernedMemoryConsentBasis;
};

export type GovernedMemoryEventType = "SOURCE_ADDED" | "FACT_PROPOSED" | "FACT_ESTABLISHED" | "FACT_DISPUTED" | "DECISION_VALIDATED" | "DECISION_SUPERSEDED" | "ACCESS_GRANTED" | "ACCESS_REVOKED" | "SYNTHESIS_VALIDATED" | "SOURCE_DELETED" | "SOURCE_RESTRICTED";
export type GovernedMemoryEvent = {
  id: GovernedMemoryEventId;
  scope: GovernedMemoryScope;
  type: GovernedMemoryEventType;
  actorType: "HUMAN" | "SYSTEM";
  actorUserId: UserId | null;
  actorRepresentationId: RepresentationId | null;
  occurredAt: string;
  recordedAt: string;
  objectRefs: readonly GovernedMemoryObjectRef[];
  summary: string;
  visibility: GovernedMemoryVisibility;
};

export type GovernedMemoryPermission = "VIEW_MEMORY" | "VIEW_SOURCES" | "REGISTER_SOURCE" | "PROPOSE_FACT" | "ESTABLISH_FACT" | "DISPUTE_FACT" | "RECORD_DECISION" | "VALIDATE_DECISION" | "VALIDATE_SYNTHESIS" | "MANAGE_MEMORY_ACCESS" | "PROMOTE_PRIVATE_SOURCE";
export type GovernedMemoryAccessGrant = {
  id: GovernedMemoryAccessGrantId;
  scope: GovernedMemoryScope;
  subjectType: "USER" | "REPRESENTATION";
  subjectUserId: UserId | null;
  subjectRepresentationId: RepresentationId | null;
  resourceType: GovernedMemoryObjectType | "MEMORY" | "SOURCES";
  resourceId: string | null;
  permission: GovernedMemoryPermission;
  grantedByUserId: UserId;
  grantedAt: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  revokedAt: string | null;
  revokedByUserId: UserId | null;
  basis: string;
  residualAccessPolicy: { permissions: readonly GovernedMemoryPermission[]; effectiveUntil: string; basis: string } | null;
};

export type GovernedMemorySynthesisStatus = "GENERATED_UNVERIFIED" | "VALIDATED" | "PARTIALLY_VALIDATED" | "DISPUTED" | "SUPERSEDED";
export type GovernedMemoryInference = {
  text: string;
  supportRefs: readonly GovernedMemoryObjectRef[];
  caution: "LOW" | "MEDIUM" | "HIGH";
  producedBy: "HUMAN" | "SYSTEM";
  validationId: GovernedMemoryValidationId | null;
  disclaimer: string;
};
export type GovernedMemoryLimitationCode = "MISSING_SOURCE" | "MISSING_RATIONALE" | "ACCESS_NOT_PROVEN" | "INACCESSIBLE_DATA" | "OPEN_CONTRADICTION" | "INCOMPLETE_TEMPORAL_COVERAGE" | "DELETED_SOURCE" | "CAUSALITY_NOT_DEMONSTRATED";
export type GovernedMemoryLimitation = { code: GovernedMemoryLimitationCode; description: string; relatedObjectRefs: readonly GovernedMemoryObjectRef[] };
export type GovernedMemoryEstablishedStatement = { factId: GovernedMemoryFactId; statement: string; evidenceLevel: GovernedMemoryEvidenceLevel; sourceRefs: readonly GovernedMemorySourceId[] };
export type GovernedMemorySynthesis = {
  id: GovernedMemorySynthesisId;
  scope: GovernedMemoryScope;
  query: string;
  referenceDate: string | null;
  generatedAt: string;
  generatedBy: "HUMAN" | "SYSTEM" | "AI_ASSISTANT";
  content: string;
  factRefs: readonly GovernedMemoryFactId[];
  decisionRefs: readonly GovernedMemoryDecisionId[];
  sourceRefs: readonly GovernedMemorySourceId[];
  synthesisRefs: readonly GovernedMemorySynthesisId[];
  limitations: readonly GovernedMemoryLimitation[];
  inferences: readonly GovernedMemoryInference[];
  status: GovernedMemorySynthesisStatus;
  validatedByUserId: UserId | null;
  validatedAt: string | null;
  supersedesSynthesisId: GovernedMemorySynthesisId | null;
  corpusFingerprint: string | null;
  visibility: GovernedMemoryVisibility;
  hasDisputedDependency: boolean;
};

export type GovernedMemoryValidationTargetType = "FACT" | "DECISION" | "SYNTHESIS" | "SOURCE_PROMOTION";
export type GovernedMemoryValidationDecision = "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED" | "WITH_RESERVATIONS";
export type GovernedMemoryValidation = {
  id: GovernedMemoryValidationId;
  scope: GovernedMemoryScope;
  targetType: GovernedMemoryValidationTargetType;
  targetId: string;
  validatorUserId: UserId;
  validatorRole: "MEMORY_STEWARD" | "MEMORY_DELEGATE" | "SOURCE_AUTHOR" | "LEGAL_AUTHORITY";
  decision: GovernedMemoryValidationDecision;
  rationale: string;
  reservations: readonly string[];
  validatedAt: string;
  sourceRefs: readonly GovernedMemorySourceId[];
};

export type GovernedMemoryDisputeStatus = "OPEN" | "RESOLVED" | "MAINTAINED" | "WITHDRAWN";
export type GovernedMemoryDispute = {
  id: GovernedMemoryDisputeId;
  scope: GovernedMemoryScope;
  targetType: "FACT" | "DECISION" | "SYNTHESIS" | "SOURCE";
  targetId: string;
  raisedByUserId: UserId;
  raisedAt: string;
  reason: string;
  sourceRefs: readonly GovernedMemorySourceId[];
  status: GovernedMemoryDisputeStatus;
  resolvedAt: string | null;
  resolvedByUserId: UserId | null;
  resolution: string | null;
};

export type GovernedMemoryRelationType = "SUPPORTED_BY" | "DERIVED_FROM" | "REPLACES" | "CORRECTS" | "CANCELS" | "COMPLEMENTS" | "CONTESTS" | "VALIDATES" | "SUMMARIZES";
export type GovernedMemoryRelation = { scope: GovernedMemoryScope; type: GovernedMemoryRelationType; from: GovernedMemoryObjectRef; to: GovernedMemoryObjectRef };

export type GovernedMemoryRole = "RELATION_CASE_OWNER" | "MEMORY_STEWARD" | "MEMORY_DELEGATE" | "CONTRIBUTOR" | "READER" | "REVOKED_PARTICIPANT" | "SYSTEM" | "AI_ASSISTANT";

export type ValidationIssue = { code: string; path: string; message: string };
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };
