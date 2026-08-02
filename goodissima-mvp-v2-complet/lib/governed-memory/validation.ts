import type {
  GovernedMemoryAccessGrant, GovernedMemoryDecision, GovernedMemoryDispute, GovernedMemoryEvent, GovernedMemoryFact,
  GovernedMemoryRelation, GovernedMemorySource, GovernedMemorySynthesis, GovernedMemoryValidation,
  GovernedMemoryVisibility, PromotePrivateMessageExcerptInput, ValidationIssue, ValidationResult,
} from "./types";
import { isAllowedRelation } from "./invariants.ts";
import { isTemporallyValid, parseInstant } from "./temporal.ts";

const MAX = { statement: 4_000, title: 300, rationale: 4_000, excerpt: 2_000, purpose: 500, reason: 4_000 } as const;
const issue = (code: string, path: string, message: string): ValidationIssue => ({ code, path, message });
const result = <T>(value: T, issues: ValidationIssue[]): ValidationResult<T> => issues.length ? { ok: false, issues } : { ok: true, value };

export function validateExactKeys(value: object, allowed: readonly string[]): ValidationIssue[] {
  return Object.keys(value).filter((key) => !allowed.includes(key)).map((key) => issue("UNKNOWN_FIELD", key, "Unknown fields are not allowed."));
}

function bounded(value: unknown, path: string, max: number, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.trim().length === 0) issues.push(issue("REQUIRED_STRING", path, "A non-empty string is required."));
  else if (value.length > max) issues.push(issue("STRING_TOO_LONG", path, `Maximum length is ${max}.`));
}

function iso(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || parseInstant(value) === null) issues.push(issue("INVALID_INSTANT", path, "A valid ISO instant is required."));
}

function scope(value: { scope?: unknown }, issues: ValidationIssue[]): void {
  const candidate = value.scope as { type?: unknown; relationCaseId?: unknown } | undefined;
  if (!candidate || candidate.type !== "RELATION_CASE" || typeof candidate.relationCaseId !== "string" || !candidate.relationCaseId) issues.push(issue("INVALID_SCOPE", "scope", "A RELATION_CASE scope is required."));
}

export function validateVisibility(value: GovernedMemoryVisibility): ValidationResult<GovernedMemoryVisibility> {
  const issues: ValidationIssue[] = [];
  if (value.kind === "SPECIFIC_SUBJECTS" && !value.subjectUserIds?.length && !value.subjectRepresentationIds?.length) issues.push(issue("VISIBILITY_SUBJECTS_REQUIRED", "visibility", "Specific subjects are required."));
  if (value.kind === "RESTRICTED" && !value.policyRef?.trim()) issues.push(issue("VISIBILITY_POLICY_REQUIRED", "visibility.policyRef", "A policy reference is required."));
  return result(value, issues);
}

export function validateFact(value: GovernedMemoryFact, now: string): ValidationResult<GovernedMemoryFact> {
  const issues: ValidationIssue[] = [];
  scope(value, issues); bounded(value.statement, "statement", MAX.statement, issues);
  if (!isTemporallyValid(value, now)) issues.push(issue("INVALID_TEMPORAL_STATE", "recordedAt", "Temporal fields are inconsistent."));
  if (value.status === "PROPOSED" && (value.establishedAt || value.establishedByUserId)) issues.push(issue("PROPOSED_CANNOT_BE_ESTABLISHED", "status", "A proposed fact cannot carry establishment fields."));
  if (value.status === "ESTABLISHED" && (!value.establishedAt || !value.establishedByUserId)) issues.push(issue("ESTABLISHMENT_REQUIRED", "establishedAt", "An established fact requires a human validator and date."));
  if (value.status === "SUPERSEDED" && !value.supersededByFactId) issues.push(issue("SUCCESSOR_REQUIRED", "supersededByFactId", "A superseded fact requires its successor."));
  if (value.supersedesFactId === value.id || value.supersededByFactId === value.id) issues.push(issue("SELF_REFERENCE", "supersedesFactId", "A fact cannot replace itself."));
  if (!value.sourceRefs.length && value.evidenceNote !== "ESTABLISHED_WITHOUT_DOCUMENTARY_EVIDENCE") issues.push(issue("UNDOCUMENTED_EVIDENCE_NOTE_REQUIRED", "evidenceNote", "Missing documentary evidence must be explicit."));
  return result(value, issues);
}

export function validateDecision(value: GovernedMemoryDecision, now: string): ValidationResult<GovernedMemoryDecision> {
  const issues: ValidationIssue[] = [];
  scope(value, issues); bounded(value.title, "title", MAX.title, issues); iso(value.decidedAt, "decidedAt", issues);
  if (!isTemporallyValid(value, now)) issues.push(issue("INVALID_TEMPORAL_STATE", "recordedAt", "Temporal fields are inconsistent."));
  if (value.status === "VALIDATED") { bounded(value.rationale, "rationale", MAX.rationale, issues); if (!value.validatedByUserId) issues.push(issue("HUMAN_VALIDATOR_REQUIRED", "validatedByUserId", "Human validation is required.")); }
  if (value.priorDecisionRefs.some((ref) => ref.decisionId === value.id)) issues.push(issue("SELF_REFERENCE", "priorDecisionRefs", "A decision cannot succeed itself."));
  if (!value.sourceRefs.length && value.evidenceNote !== "DECIDED_WITHOUT_DOCUMENTARY_SOURCE") issues.push(issue("UNDOCUMENTED_DECISION_NOTE_REQUIRED", "evidenceNote", "The absence of a documentary source must be explicit."));
  return result(value, issues);
}

export function validateSource(value: GovernedMemorySource, now: string): ValidationResult<GovernedMemorySource> {
  const issues: ValidationIssue[] = [];
  scope(value, issues); bounded(value.title, "title", MAX.title, issues); iso(value.recordedAt, "recordedAt", issues);
  if ((parseInstant(value.recordedAt) ?? Infinity) > (parseInstant(now) ?? -Infinity)) issues.push(issue("RECORDED_IN_FUTURE", "recordedAt", "Recorded time cannot be in the future."));
  if (value.kind === "MESSAGE_EXCERPT" && (!value.promotedAt || !value.promotedByUserId)) issues.push(issue("HUMAN_PROMOTION_REQUIRED", "promotedByUserId", "A private excerpt requires explicit human promotion."));
  if (["DELETED", "ANONYMIZED"].includes(value.status) && !value.unavailableReason) issues.push(issue("UNAVAILABLE_REASON_REQUIRED", "unavailableReason", "Unavailable sources require a reason."));
  if (value.kind === "VALIDATED_SYNTHESIS" && !value.primarySourceRefs.length) issues.push(issue("PRIMARY_TRACE_REQUIRED", "primarySourceRefs", "A secondary source must trace to a primary source."));
  if (value.kind === "EXTERNAL_IMPORT" && !value.externalOrigin) issues.push(issue("EXTERNAL_ORIGIN_REQUIRED", "externalOrigin", "External origin must be explicit."));
  return result(value, issues);
}

export function validateEvent(value: GovernedMemoryEvent): ValidationResult<GovernedMemoryEvent> {
  const issues: ValidationIssue[] = [];
  scope(value, issues); bounded(value.summary, "summary", 2_000, issues); iso(value.occurredAt, "occurredAt", issues); iso(value.recordedAt, "recordedAt", issues);
  if (value.actorType === "SYSTEM" && (value.actorUserId || value.actorRepresentationId)) issues.push(issue("SYSTEM_ACTOR_MUST_BE_IMPERSONAL", "actorUserId", "A system event cannot impersonate a human actor."));
  if (value.actorType === "HUMAN" && !value.actorUserId) issues.push(issue("HUMAN_ACTOR_REQUIRED", "actorUserId", "A human event requires its actor."));
  return result(value, issues);
}

export function validatePrivateMessagePromotion(value: PromotePrivateMessageExcerptInput, originalVisibility: GovernedMemoryVisibility): ValidationResult<PromotePrivateMessageExcerptInput> {
  const issues: ValidationIssue[] = [];
  bounded(value.messageId, "messageId", 200, issues); bounded(value.excerpt, "excerpt", MAX.excerpt, issues); bounded(value.purpose, "purpose", MAX.purpose, issues);
  if (!value.consentBasis || !["AUTHOR_PROMOTED_OWN_MESSAGE", "EXPLICIT_AUTHOR_CONSENT", "DOCUMENTED_GOVERNANCE_AUTHORITY", "DOCUMENTED_LEGAL_OBLIGATION"].includes(value.consentBasis.type)) issues.push(issue("CONSENT_BASIS_REQUIRED", "consentBasis", "A documented consent basis is required."));
  if ((value.consentBasis?.type === "EXPLICIT_AUTHOR_CONSENT" && !value.consentBasis.evidenceRef) || (value.consentBasis?.type === "DOCUMENTED_GOVERNANCE_AUTHORITY" && !value.consentBasis.authorityRef) || (value.consentBasis?.type === "DOCUMENTED_LEGAL_OBLIGATION" && !value.consentBasis.obligationRef)) issues.push(issue("CONSENT_EVIDENCE_REQUIRED", "consentBasis", "The consent basis needs evidence."));
  const rank = { PRIVATE_TO_AUTHOR: 0, SPECIFIC_SUBJECTS: 1, RESTRICTED: 1, MEMORY_STEWARDS: 2, CASE_PARTICIPANTS: 3 } as const;
  if (rank[value.visibility.kind] > rank[originalVisibility.kind]) issues.push(issue("VISIBILITY_TOO_BROAD", "visibility", "Promotion cannot broaden visibility."));
  const visibilityResult = validateVisibility(value.visibility);
  if (!visibilityResult.ok) issues.push(...visibilityResult.issues);
  return result(value, issues);
}

export function validateSynthesis(value: GovernedMemorySynthesis): ValidationResult<GovernedMemorySynthesis> {
  const issues: ValidationIssue[] = [];
  scope(value, issues); bounded(value.query, "query", 2_000, issues); bounded(value.content, "content", 20_000, issues);
  if (!Array.isArray(value.limitations)) issues.push(issue("LIMITATIONS_REQUIRED", "limitations", "Limitations must be explicit, including an empty array."));
  if (value.status === "VALIDATED" && (!value.validatedAt || !value.validatedByUserId)) issues.push(issue("HUMAN_VALIDATOR_REQUIRED", "validatedByUserId", "A validated synthesis requires human validation."));
  if (value.status === "GENERATED_UNVERIFIED" && (value.validatedAt || value.validatedByUserId)) issues.push(issue("UNVERIFIED_CANNOT_BE_VALIDATED", "status", "An unverified synthesis cannot carry validation fields."));
  if (value.supersedesSynthesisId === value.id || value.synthesisRefs.includes(value.id)) issues.push(issue("SELF_REFERENCE", "synthesisRefs", "A synthesis cannot depend on itself."));
  for (const inference of value.inferences) if (!inference.disclaimer.trim()) issues.push(issue("INFERENCE_DISCLAIMER_REQUIRED", "inferences", "Inference must be labelled as non-factual."));
  return result(value, issues);
}

export function validateValidation(value: GovernedMemoryValidation): ValidationResult<GovernedMemoryValidation> {
  const issues: ValidationIssue[] = [];
  scope(value, issues); iso(value.validatedAt, "validatedAt", issues);
  if (["REJECTED", "WITH_RESERVATIONS", "PARTIALLY_APPROVED"].includes(value.decision)) bounded(value.rationale, "rationale", MAX.rationale, issues);
  if (["WITH_RESERVATIONS", "PARTIALLY_APPROVED"].includes(value.decision) && !value.reservations.length) issues.push(issue("RESERVATIONS_REQUIRED", "reservations", "Reservations must be explicit."));
  return result(value, issues);
}

export function validateDispute(value: GovernedMemoryDispute): ValidationResult<GovernedMemoryDispute> {
  const issues: ValidationIssue[] = [];
  scope(value, issues); bounded(value.reason, "reason", MAX.reason, issues); iso(value.raisedAt, "raisedAt", issues);
  if (value.status === "OPEN" && (value.resolvedAt || value.resolvedByUserId || value.resolution)) issues.push(issue("OPEN_DISPUTE_CANNOT_BE_RESOLVED", "status", "An open dispute cannot carry resolution fields."));
  if (["RESOLVED", "MAINTAINED"].includes(value.status) && (!value.resolvedAt || !value.resolvedByUserId || !value.resolution)) issues.push(issue("RESOLUTION_REQUIRED", "resolution", "Human resolution is required."));
  return result(value, issues);
}

export function validateAccessGrant(value: GovernedMemoryAccessGrant): ValidationResult<GovernedMemoryAccessGrant> {
  const issues: ValidationIssue[] = [];
  scope(value, issues); bounded(value.basis, "basis", 1_000, issues); iso(value.grantedAt, "grantedAt", issues); iso(value.effectiveFrom, "effectiveFrom", issues);
  if (value.subjectType === "USER" ? !value.subjectUserId || value.subjectRepresentationId : !value.subjectRepresentationId || value.subjectUserId) issues.push(issue("INVALID_ACCESS_SUBJECT", "subjectType", "Exactly one compatible subject is required."));
  if (value.effectiveUntil && (parseInstant(value.effectiveUntil) ?? 0) <= (parseInstant(value.effectiveFrom) ?? 0)) issues.push(issue("INVALID_INTERVAL", "effectiveUntil", "The end must be after the start."));
  if (value.revokedAt && !value.revokedByUserId) issues.push(issue("REVOCATION_ACTOR_REQUIRED", "revokedByUserId", "Revocation requires an actor."));
  return result(value, issues);
}

export function validateRelation(value: GovernedMemoryRelation): ValidationResult<GovernedMemoryRelation> {
  return isAllowedRelation(value) ? { ok: true, value } : { ok: false, issues: [issue("RELATION_NOT_ALLOWED", "type", "Object types, scope or self-reference are not allowed.")] };
}
