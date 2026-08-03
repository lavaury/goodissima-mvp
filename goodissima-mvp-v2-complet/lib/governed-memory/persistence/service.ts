import type { GovernedMemoryEvidenceLevel, GovernedMemoryPermission, GovernedMemoryRole, GovernedMemorySourceKind, GovernedMemorySourceStatus, GovernedMemoryTargetType, GovernedMemoryValidationDecision } from "@prisma/client";
import { canEstablishFact, canManageMemoryAccess, canPromotePrivateSource, canProposeFact, canValidateDecision, resolveMemoryPermissions } from "./permission-resolver";
import { governedMemoryRepository, type GovernedMemoryRepository } from "./repository";

export type GovernedMemoryServiceErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT";
export class GovernedMemoryServiceError extends Error {
  constructor(readonly code: GovernedMemoryServiceErrorCode, message: string) { super(message); this.name = "GovernedMemoryServiceError"; }
}

const required = (value: string, name: string, max: number) => { if (!value?.trim() || value.length > max) throw new GovernedMemoryServiceError("INVALID_INPUT", `${name} is invalid.`); return value.trim(); };
const interval = (from: Date, until?: Date | null) => { if (!Number.isFinite(from.getTime()) || (until && (!Number.isFinite(until.getTime()) || until <= from))) throw new GovernedMemoryServiceError("INVALID_INPUT", "Temporal interval is invalid."); };
async function permission(relationCaseId: string, actorUserId: string, now: Date, predicate: (value: Awaited<ReturnType<typeof resolveMemoryPermissions>>) => boolean, repository: GovernedMemoryRepository) {
  const resolved = await resolveMemoryPermissions(relationCaseId, actorUserId, now, repository);
  if (!resolved || !predicate(resolved)) throw new GovernedMemoryServiceError("NOT_FOUND", "Memory scope not found.");
  return resolved;
}
async function authorityRole(relationCaseId: string, userId: string, now: Date, repository: GovernedMemoryRepository): Promise<GovernedMemoryRole> {
  const roles = await repository.findActiveRoles(relationCaseId, userId, now);
  const role = roles.find(({ role }) => role === "MEMORY_STEWARD")?.role ?? roles.find(({ role }) => role === "MEMORY_DELEGATE")?.role;
  if (!role) throw new GovernedMemoryServiceError("FORBIDDEN", "Explicit memory authority is required.");
  return role;
}

export async function proposeFact(actorUserId: string, input: { relationCaseId: string; statement: string; evidenceLevel: GovernedMemoryEvidenceLevel; authorRepresentationId?: string | null; effectiveFrom: Date; effectiveUntil?: Date | null }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  await permission(input.relationCaseId, actorUserId, now, canProposeFact, repository); interval(input.effectiveFrom, input.effectiveUntil);
  return repository.createProposedFact({ ...input, statement: required(input.statement, "statement", 4_000), authorUserId: actorUserId, recordedAt: now });
}

export async function establishFact(actorUserId: string, input: { relationCaseId: string; factId: string; expectedUpdatedAt: Date; rationale: string }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  await permission(input.relationCaseId, actorUserId, now, canEstablishFact, repository); const role = await authorityRole(input.relationCaseId, actorUserId, now, repository);
  const fact = await repository.establishFactConditionally({ relationCaseId: input.relationCaseId, id: input.factId, expectedUpdatedAt: input.expectedUpdatedAt, validatorUserId: actorUserId, validatorRole: role, rationale: required(input.rationale, "rationale", 4_000), now });
  if (!fact) throw new GovernedMemoryServiceError("CONFLICT", "Fact changed or cannot be established."); return fact;
}

export async function supersedeFact(actorUserId: string, input: { relationCaseId: string; priorFactId: string; expectedUpdatedAt: Date; statement: string; evidenceLevel: GovernedMemoryEvidenceLevel; effectiveFrom: Date }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  await permission(input.relationCaseId, actorUserId, now, canProposeFact, repository); interval(input.effectiveFrom);
  const result = await repository.supersedeFactTransactionally({ ...input, actorUserId, statement: required(input.statement, "statement", 4_000), now });
  if (!result) throw new GovernedMemoryServiceError("CONFLICT", "Fact changed or cannot be superseded."); return result;
}

export async function createDecisionDraft(actorUserId: string, input: { relationCaseId: string; title: string; rationale: string; decidedAt: Date; effectiveFrom: Date; effectiveUntil?: Date | null; consequences?: string | null; reservations?: string | null }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  await permission(input.relationCaseId, actorUserId, now, (resolved) => resolved?.permissions.has("RECORD_DECISION") === true, repository); interval(input.effectiveFrom, input.effectiveUntil);
  return repository.createDraftDecision({ ...input, title: required(input.title, "title", 300), rationale: input.rationale.trim(), decidedByUserId: actorUserId, recordedAt: now });
}

export async function updateDecisionDraft(actorUserId: string, input: { relationCaseId: string; decisionId: string; expectedUpdatedAt: Date; title?: string; rationale?: string; effectiveFrom?: Date; effectiveUntil?: Date | null; consequences?: string | null; reservations?: string | null }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  await permission(input.relationCaseId, actorUserId, now, (resolved) => resolved?.permissions.has("RECORD_DECISION") === true, repository);
  const { relationCaseId, decisionId, expectedUpdatedAt, ...data } = input; if (data.title) data.title = required(data.title, "title", 300);
  const changed = await repository.updateDraftDecisionConditionally(relationCaseId, decisionId, expectedUpdatedAt, data); if (changed.count !== 1) throw new GovernedMemoryServiceError("CONFLICT", "Only the current draft can be updated.");
}

export async function validateDecision(actorUserId: string, input: { relationCaseId: string; decisionId: string; expectedUpdatedAt: Date; rationale: string }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  await permission(input.relationCaseId, actorUserId, now, canValidateDecision, repository); const role = await authorityRole(input.relationCaseId, actorUserId, now, repository);
  const decision = await repository.validateDecisionConditionally({ relationCaseId: input.relationCaseId, id: input.decisionId, expectedUpdatedAt: input.expectedUpdatedAt, validatorUserId: actorUserId, validatorRole: role, rationale: required(input.rationale, "rationale", 4_000), now });
  if (!decision) throw new GovernedMemoryServiceError("CONFLICT", "Decision changed or is immutable."); return decision;
}

export async function createSuccessorDecision(actorUserId: string, input: { relationCaseId: string; priorDecisionId: string; type: "REPLACES" | "CORRECTS" | "CANCELS" | "COMPLEMENTS"; title: string; rationale: string; effectiveFrom: Date }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  await permission(input.relationCaseId, actorUserId, now, (resolved) => resolved?.permissions.has("RECORD_DECISION") === true, repository);
  const successor = await repository.createSuccessorDecision({ ...input, title: required(input.title, "title", 300), rationale: required(input.rationale, "rationale", 4_000), actorUserId, now });
  if (!successor) throw new GovernedMemoryServiceError("NOT_FOUND", "Prior validated decision not found."); return successor;
}

const sourceTypes: Readonly<Record<GovernedMemorySourceKind, string | null>> = { DOCUMENT: "Document", DOCUMENT_VERSION: null, FORM_SUBMISSION: "FormSubmission", MESSAGE_EXCERPT: "Message", SYSTEM_EVENT: "RelationEvent", HUMAN_DECLARATION: null, VALIDATED_SYNTHESIS: null, EXTERNAL_IMPORT: null };
export type GovernedJourneyMemoryProvenance = { governedJourneyId?: string | null; governedJourneyEventId?: string | null };
const normalizeProvenance = (input: GovernedJourneyMemoryProvenance) => {
  const governedJourneyId = input.governedJourneyId ?? null;
  const governedJourneyEventId = input.governedJourneyEventId ?? null;
  if (governedJourneyEventId && !governedJourneyId) throw new GovernedMemoryServiceError("INVALID_INPUT", "A governed journey event requires its journey.");
  return { governedJourneyId, governedJourneyEventId };
};
async function registerSourceSafely(repository: GovernedMemoryRepository, input: Parameters<GovernedMemoryRepository["registerSource"]>[0], actorUserId: string, now: Date) {
  try { return await repository.registerSource(input, actorUserId, now); }
  catch { throw new GovernedMemoryServiceError("NOT_FOUND", "Memory provenance not found."); }
}
export async function registerMemorySource(actorUserId: string, input: { relationCaseId: string; kind: Exclude<GovernedMemorySourceKind, "MESSAGE_EXCERPT" | "VALIDATED_SYNTHESIS">; sourceObjectId: string; title: string; authoredAt?: Date | null; receivedAt?: Date | null; visibilityPolicyRef?: string | null; retentionPolicyRef?: string | null; integrityRef?: string | null; externalOrigin?: string | null } & GovernedJourneyMemoryProvenance, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  const provenance = normalizeProvenance(input);
  await permission(input.relationCaseId, actorUserId, now, (resolved) => resolved?.permissions.has("VIEW_SOURCES") === true, repository);
  const sourceObjectType = sourceTypes[input.kind]; if (sourceObjectType && !await repository.findSourceObjectInCase(input.relationCaseId, sourceObjectType, input.sourceObjectId)) throw new GovernedMemoryServiceError("NOT_FOUND", "Source object not found.");
  if (input.kind === "EXTERNAL_IMPORT" && !input.externalOrigin?.trim()) throw new GovernedMemoryServiceError("INVALID_INPUT", "External origin is required.");
  return registerSourceSafely(repository, { ...input, ...provenance, title: required(input.title, "title", 300), sourceObjectType: sourceObjectType ?? input.kind, status: "ACTIVE", recordedAt: now }, actorUserId, now);
}

export async function promotePrivateMessageExcerpt(actorUserId: string, input: { relationCaseId: string; messageId: string; excerpt: string; purpose: string; consentBasis: "AUTHOR_PROMOTED_OWN_MESSAGE" | `EXPLICIT_AUTHOR_CONSENT:${string}` | `DOCUMENTED_GOVERNANCE_AUTHORITY:${string}` | `DOCUMENTED_LEGAL_OBLIGATION:${string}`; visibilityPolicyRef: "PRIVATE_TO_AUTHOR" | `RESTRICTED:${string}`; title: string } & GovernedJourneyMemoryProvenance, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  const provenance = normalizeProvenance(input);
  await permission(input.relationCaseId, actorUserId, now, canPromotePrivateSource, repository);
  if (!await repository.findSourceObjectInCase(input.relationCaseId, "Message", input.messageId)) throw new GovernedMemoryServiceError("NOT_FOUND", "Private message not found.");
  required(input.consentBasis, "consentBasis", 1_000); required(input.visibilityPolicyRef, "visibilityPolicyRef", 1_000);
  return registerSourceSafely(repository, { relationCaseId: input.relationCaseId, ...provenance, kind: "MESSAGE_EXCERPT", status: "RESTRICTED", sourceObjectType: "Message", sourceObjectId: input.messageId, title: required(input.title, "title", 300), excerpt: required(input.excerpt, "excerpt", 2_000), promotionPurpose: required(input.purpose, "purpose", 500), consentBasis: input.consentBasis, visibilityPolicyRef: input.visibilityPolicyRef, promotedByUserId: actorUserId, promotedAt: now, recordedAt: now }, actorUserId, now);
}

export async function grantMemoryPermission(actorUserId: string, input: { relationCaseId: string; subjectType: "USER" | "REPRESENTATION"; subjectUserId?: string | null; subjectRepresentationId?: string | null; permission: GovernedMemoryPermission; resourceType?: GovernedMemoryTargetType | null; resourceId?: string | null; basis: string; effectiveFrom: Date; effectiveUntil?: Date | null; residualPermission?: GovernedMemoryPermission | null; residualEffectiveUntil?: Date | null; residualBasis?: string | null }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) {
  await permission(input.relationCaseId, actorUserId, now, canManageMemoryAccess, repository); interval(input.effectiveFrom, input.effectiveUntil);
  const exactlyOne = input.subjectType === "USER" ? Boolean(input.subjectUserId && !input.subjectRepresentationId) : Boolean(input.subjectRepresentationId && !input.subjectUserId); if (!exactlyOne) throw new GovernedMemoryServiceError("INVALID_INPUT", "Exactly one compatible subject is required.");
  return repository.grantPermission({ ...input, basis: required(input.basis, "basis", 1_000), grantedByUserId: actorUserId, grantedAt: now }, actorUserId, now);
}

export async function revokeMemoryPermission(actorUserId: string, input: { relationCaseId: string; grantId: string; expectedUpdatedAt: Date }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) { await permission(input.relationCaseId, actorUserId, now, canManageMemoryAccess, repository); if (!await repository.revokePermissionConditionally(input.relationCaseId, input.grantId, input.expectedUpdatedAt, actorUserId, now)) throw new GovernedMemoryServiceError("CONFLICT", "Grant changed or is already revoked."); }

export async function openMemoryDispute(actorUserId: string, input: { relationCaseId: string; targetType: GovernedMemoryTargetType; targetId: string; reason: string }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) { await permission(input.relationCaseId, actorUserId, now, (resolved) => resolved?.permissions.has("DISPUTE_FACT") === true, repository); const dispute = await repository.openDispute({ ...input, raisedByUserId: actorUserId, reason: required(input.reason, "reason", 4_000), status: "OPEN", raisedAt: now }); if (!dispute) throw new GovernedMemoryServiceError("NOT_FOUND", "Dispute target not found."); return dispute; }

export async function resolveMemoryDispute(actorUserId: string, input: { relationCaseId: string; disputeId: string; expectedUpdatedAt: Date; status: "RESOLVED" | "MAINTAINED" | "WITHDRAWN"; resolution: string }, repository: GovernedMemoryRepository = governedMemoryRepository, now = new Date()) { const resolved = await resolveMemoryPermissions(input.relationCaseId, actorUserId, now, repository); if (!resolved) throw new GovernedMemoryServiceError("NOT_FOUND", "Memory scope not found."); const authorityMayWithdraw = canEstablishFact(resolved); if (input.status !== "WITHDRAWN" && !authorityMayWithdraw) throw new GovernedMemoryServiceError("NOT_FOUND", "Dispute not found."); if (!await repository.resolveDisputeConditionally({ relationCaseId: input.relationCaseId, id: input.disputeId, expectedUpdatedAt: input.expectedUpdatedAt, status: input.status, actorUserId, authorityMayWithdraw, resolution: required(input.resolution, "resolution", 4_000), now })) throw new GovernedMemoryServiceError("CONFLICT", "Dispute changed or cannot be resolved."); }
