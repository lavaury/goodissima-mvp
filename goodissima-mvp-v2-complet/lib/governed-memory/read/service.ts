import { filterMemoryReadByCurrentAccess } from "./access-filter";
import { compareMemoryStates } from "./comparison";
import { dedupeLimitations, limitation } from "./limitations";
import { governedMemoryReadRepository, type GovernedMemoryReadRepository, type GovernedMemoryTransactionalReader } from "./repository";
import { accessView, buildMemoryState } from "./state-builder";
import type { CompareMemoryPeriodsInput, ExplainDecisionInput, GetMemoryStateAtInput, GovernedMemoryAccessReconstruction, GovernedMemoryDecisionExplanation, GovernedMemoryDecisionView, GovernedMemoryDisputeView, GovernedMemoryFactView, GovernedMemoryReadInclude, GovernedMemoryReadResult, GovernedMemoryRoleView, ReconstructAccessAtInput, ReadCursor } from "./types";

export type GovernedMemoryReadErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "INVALID_DATE_RANGE" | "UNSUPPORTED_KNOWLEDGE_MODE" | "PAGE_LIMIT_EXCEEDED" | "INCONSISTENT_MEMORY_GRAPH" | "INCOMPLETE_HISTORY";
export class GovernedMemoryReadError extends Error { constructor(readonly code: GovernedMemoryReadErrorCode, message: string) { super(message); this.name = "GovernedMemoryReadError"; } }

const DEFAULT_INCLUDES: GovernedMemoryReadInclude[] = ["FACTS", "DECISIONS", "SOURCES", "DISPUTES", "VALIDATIONS", "TIMELINE"];
function date(value: string, name: string) { const parsed = new Date(value); if (!value || !Number.isFinite(parsed.getTime())) throw new GovernedMemoryReadError("INVALID_INPUT", `${name} is invalid.`); return parsed; }
function limit(value?: number) { const resolved = value ?? 50; if (!Number.isInteger(resolved) || resolved < 1) throw new GovernedMemoryReadError("INVALID_INPUT", "limit is invalid."); if (resolved > 200) throw new GovernedMemoryReadError("PAGE_LIMIT_EXCEEDED", "Requested page exceeds the maximum."); return resolved; }
function decodeCursor(value?: string): ReadCursor | null { if (!value) return null; try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as ReadCursor; if (!parsed.id || !Number.isFinite(Date.parse(parsed.recordedAt))) throw new Error(); return parsed; } catch { throw new GovernedMemoryReadError("INVALID_INPUT", "cursor is invalid."); } }
function encodeCursor(value: ReadCursor) { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url"); }
async function currentAccess(relationCaseId: string, requesterUserId: string, now: Date, reader: GovernedMemoryTransactionalReader) { const resolved = await reader.resolveCurrentAccess(relationCaseId, requesterUserId, now); if (!resolved?.permissions.has("VIEW_MEMORY")) throw new GovernedMemoryReadError("NOT_FOUND", "Memory not found."); return resolved; }

async function stateInSnapshot(input: GetMemoryStateAtInput, reader: GovernedMemoryTransactionalReader, now: Date): Promise<GovernedMemoryReadResult> {
  if (!input.relationCaseId || !input.requesterUserId) throw new GovernedMemoryReadError("INVALID_INPUT", "Scope and requester are required.");
  if (!["KNOWN_AT_DATE", "CURRENT_KNOWLEDGE_ABOUT_DATE"].includes(input.knowledgeMode)) throw new GovernedMemoryReadError("UNSUPPORTED_KNOWLEDGE_MODE", "Knowledge mode is unsupported.");
  const referenceDate = date(input.referenceDate, "referenceDate"); const pageLimit = limit(input.limit); const cursor = decodeCursor(input.cursor);
  const access = await currentAccess(input.relationCaseId, input.requesterUserId, now, reader);
  const snapshot = await reader.readSnapshot({ relationCaseId: input.relationCaseId, referenceDate, knowledgeCutoff: input.knowledgeMode === "KNOWN_AT_DATE" ? referenceDate : now, limit: pageLimit, cursor });
  if (!snapshot) throw new GovernedMemoryReadError("NOT_FOUND", "Memory not found.");
  const last = snapshot.truncated.facts ? snapshot.facts[pageLimit - 1] : null;
  return buildMemoryState({ snapshot, access, referenceDate, knowledgeMode: input.knowledgeMode, generatedAt: now, limit: pageLimit, nextCursor: last ? encodeCursor({ recordedAt: last.recordedAt.toISOString(), id: last.id }) : null, includes: new Set(input.include ?? DEFAULT_INCLUDES) });
}

export async function getMemoryStateAt(input: GetMemoryStateAtInput, repository: GovernedMemoryReadRepository = governedMemoryReadRepository, now = new Date()): Promise<GovernedMemoryReadResult> {
  const operationNow = new Date(now);
  return repository.runInSnapshot((reader) => stateInSnapshot(input, reader, operationNow));
}

export async function compareMemoryPeriods(input: CompareMemoryPeriodsInput, repository: GovernedMemoryReadRepository = governedMemoryReadRepository, now = new Date()) {
  const operationNow = new Date(now);
  const from = date(input.from, "from"); const to = date(input.to, "to"); if (from >= to) throw new GovernedMemoryReadError("INVALID_DATE_RANGE", "Date range is invalid.");
  if (!["KNOWN_AT_EACH_DATE", "CURRENT_KNOWLEDGE_ABOUT_PERIOD"].includes(input.knowledgeMode)) throw new GovernedMemoryReadError("UNSUPPORTED_KNOWLEDGE_MODE", "Knowledge mode is unsupported.");
  const mode = input.knowledgeMode === "KNOWN_AT_EACH_DATE" ? "KNOWN_AT_DATE" : "CURRENT_KNOWLEDGE_ABOUT_DATE";
  const include = input.include ?? ["FACTS", "DECISIONS", "SOURCES", "DISPUTES", "ACCESS"];
  return repository.runInSnapshot(async (reader) => {
    const access = await currentAccess(input.relationCaseId, input.requesterUserId, operationNow, reader);
    const build = async (referenceDate: Date) => {
      const snapshot = await reader.readSnapshot({ relationCaseId: input.relationCaseId, referenceDate, knowledgeCutoff: mode === "KNOWN_AT_DATE" ? referenceDate : operationNow, limit: 200, cursor: null });
      if (!snapshot) throw new GovernedMemoryReadError("NOT_FOUND", "Memory not found.");
      return buildMemoryState({ snapshot, access, referenceDate, knowledgeMode: mode, generatedAt: operationNow, limit: 200, nextCursor: null, includes: new Set(include) });
    };
    const [fromState, toState] = await Promise.all([build(from), build(to)]);
    return { ...toState, referenceDate: undefined, period: { from: from.toISOString(), to: to.toISOString() }, knowledgeMode: input.knowledgeMode, changes: compareMemoryStates(fromState, toState), limitations: dedupeLimitations([...fromState.limitations, ...toState.limitations]) };
  });
}

export async function explainDecision(input: ExplainDecisionInput, repository: GovernedMemoryReadRepository = governedMemoryReadRepository, now = new Date()): Promise<GovernedMemoryDecisionExplanation> {
  const operationNow = new Date(now);
  return repository.runInSnapshot(async (reader) => {
  const reference = input.referenceDate ? date(input.referenceDate, "referenceDate") : operationNow; const access = await currentAccess(input.relationCaseId, input.requesterUserId, operationNow, reader);
  const trace = await reader.getDecisionTrace(input.relationCaseId, input.decisionId, reference); if (!trace) throw new GovernedMemoryReadError("NOT_FOUND", "Decision not found.");
  const filtered = filterMemoryReadByCurrentAccess(trace.sources as never[], access); const limitations = [limitation("CAUSALITY_NOT_ESTABLISHED", "DECISION", trace.decision.id, "INFO"), limitation("POLYMORPHIC_REFERENCE_UNVERIFIED", "DECISION", trace.decision.id, "INFO")];
  if (!trace.sources.length) limitations.push(limitation("SOURCE_NOT_LINKED", "DECISION", trace.decision.id, "INFO")); if (filtered.redactions.length) limitations.push(limitation("SOURCE_REDACTED", "DECISION", trace.decision.id, "MATERIAL"));
  const decision: GovernedMemoryDecisionView = { id: trace.decision.id, title: trace.decision.title, declaredRationale: trace.decision.rationale, statusAtReference: trace.decision.validatedAt && trace.decision.validatedAt <= reference ? "VALIDATED" : "DRAFT", decidedByUserId: trace.decision.decidedByUserId, validatedByUserId: trace.decision.validatedByUserId, decidedAt: trace.decision.decidedAt.toISOString(), validatedAt: trace.decision.validatedAt?.toISOString() ?? null, effectiveFrom: trace.decision.effectiveFrom.toISOString(), effectiveUntil: trace.decision.effectiveUntil?.toISOString() ?? null, recordedAt: trace.decision.recordedAt.toISOString(), knowledgeTiming: trace.decision.recordedAt <= reference ? "KNOWN_THEN" : "RECORDED_LATER", sourceRefs: filtered.visible.map((source) => ({ type: "SOURCE", id: source.id })), factRefs: trace.facts.map((fact) => ({ type: "FACT", id: fact.id })), disputeState: trace.disputes.some((row) => !row.resolvedAt || row.resolvedAt > reference) ? "OPEN" : "NONE", reservations: trace.decision.reservations, consequences: trace.decision.consequences };
  const facts: GovernedMemoryFactView[] = trace.facts.map((row) => ({ id: row.id, statement: row.statement, statusAtReference: row.establishedAt && row.establishedAt <= reference ? "ESTABLISHED" : "PROPOSED", evidenceLevel: row.evidenceLevel, effectiveFrom: row.effectiveFrom.toISOString(), effectiveUntil: row.effectiveUntil?.toISOString() ?? null, recordedAt: row.recordedAt.toISOString(), knowledgeTiming: row.recordedAt <= reference ? "KNOWN_THEN" : "RECORDED_LATER", sourceRefs: [], disputeState: "NONE" }));
  const disputes: GovernedMemoryDisputeView[] = trace.disputes.filter((row) => !row.resolvedAt || row.resolvedAt > reference).map((row) => ({ id: row.id, targetType: row.targetType, targetId: row.targetId, statusAtReference: "OPEN", raisedAt: row.raisedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, reason: row.reason, resolution: null }));
  return { decision, declaredRationale: decision.declaredRationale, explicitSupportingFacts: facts, explicitSupportingSources: filtered.visible, relatedPriorDecisions: trace.priorDecisions.map((row) => ({ ...decision, id: row.id, title: row.title, declaredRationale: row.rationale, decidedByUserId: row.decidedByUserId, validatedByUserId: row.validatedByUserId, decidedAt: row.decidedAt.toISOString(), validatedAt: row.validatedAt?.toISOString() ?? null, effectiveFrom: row.effectiveFrom.toISOString(), effectiveUntil: row.effectiveUntil?.toISOString() ?? null, recordedAt: row.recordedAt.toISOString(), reservations: row.reservations, consequences: row.consequences, sourceRefs: [], factRefs: [] })), laterConsequences: decision.consequences, openDisputes: disputes, validations: trace.validations.map((row) => ({ id: row.id, targetType: row.targetType, targetId: row.targetId, validatorUserId: row.validatorUserId, validatorRole: row.validatorRole, decision: row.decision, rationale: row.rationale, reservations: row.reservations, validatedAt: row.validatedAt.toISOString() })), events: trace.events.filter((row) => row.objectType !== "SOURCE").map((row) => ({ id: row.id, type: row.type, actorType: row.actorType, actorUserId: row.actorUserId, objectType: row.objectType, objectId: row.objectId, occurredAt: row.occurredAt.toISOString(), recordedAt: row.recordedAt.toISOString(), summary: row.summary })), limitations: dedupeLimitations(limitations), redactions: filtered.redactions };
  });
}

export async function reconstructAccessAt(input: ReconstructAccessAtInput, repository: GovernedMemoryReadRepository = governedMemoryReadRepository, now = new Date()): Promise<GovernedMemoryAccessReconstruction> {
  const operationNow = new Date(now);
  return repository.runInSnapshot(async (reader) => {
  const reference = date(input.referenceDate, "referenceDate"); const requester = await currentAccess(input.relationCaseId, input.requesterUserId, operationNow, reader);
  const subjectCount = Number(Boolean(input.subjectUserId)) + Number(Boolean(input.subjectRepresentationId)); if (subjectCount !== 1) throw new GovernedMemoryReadError("INVALID_INPUT", "Exactly one subject is required.");
  const subjectId = input.subjectUserId ?? input.subjectRepresentationId as string; if (subjectId !== input.requesterUserId && !requester.permissions.has("MANAGE_MEMORY_ACCESS")) throw new GovernedMemoryReadError("NOT_FOUND", "Access history not found.");
  const snapshot = await reader.readSnapshot({ relationCaseId: input.relationCaseId, referenceDate: reference, knowledgeCutoff: operationNow, limit: 1, cursor: null }); if (!snapshot) throw new GovernedMemoryReadError("NOT_FOUND", "Access history not found.");
  const views = snapshot.grants.filter((row) => input.subjectUserId ? row.subjectUserId === input.subjectUserId : row.subjectRepresentationId === input.subjectRepresentationId).map((row) => accessView(row, reference));
  const roles: GovernedMemoryRoleView[] = input.subjectUserId ? snapshot.roles.filter((row) => row.userId === input.subjectUserId).map((row) => ({ id: row.id, userId: row.userId, role: row.role, assignedAt: row.assignedAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null, activeAtReference: row.assignedAt <= reference && (!row.revokedAt || row.revokedAt > reference) })) : [];
  const active = views.filter((row) => row.stateAtReference === "ACTIVE"); const residual = views.filter((row) => row.stateAtReference === "RESIDUAL"); const revoked = views.filter((row) => ["REVOKED", "EXPIRED"].includes(row.stateAtReference));
  return { subject: { type: input.subjectUserId ? "USER" : "REPRESENTATION", id: subjectId }, referenceDate: reference.toISOString(), activeRoles: roles.filter((row) => row.activeAtReference), activeGrants: active, residualGrants: residual, revokedGrants: revoked, effectivePermissions: [...new Set([...active, ...residual].map((row) => row.permission))].sort(), restrictedResources: views.filter((row) => row.resourceType && row.resourceId && row.stateAtReference !== "ACTIVE").map((row) => ({ type: row.resourceType!, id: requester.permissions.has("VIEW_SOURCES") ? row.resourceId : null })), limitations: [limitation("ACCESS_NOT_EQUAL_TO_CONSULTATION", "ACCESS", null, "INFO"), limitation("CONSULTATION_LOG_UNAVAILABLE", "ACCESS", null, "WARNING")], redactions: [] };
  });
}

export async function getMemoryTimeline(input: Omit<GetMemoryStateAtInput, "include">, repository: GovernedMemoryReadRepository = governedMemoryReadRepository, now = new Date()) { const result = await getMemoryStateAt({ ...input, include: ["TIMELINE"] }, repository, now); return { timeline: result.timeline, limitations: result.limitations, redactions: result.redactions, pagination: result.pagination }; }
export async function getMemoryObjectTrace(input: { relationCaseId: string; requesterUserId: string; objectType: "FACT" | "DECISION" | "SOURCE"; objectId: string; referenceDate?: string }, repository: GovernedMemoryReadRepository = governedMemoryReadRepository, now = new Date()) {
  const operationNow = new Date(now);
  return repository.runInSnapshot(async (reader) => { const cutoff = input.referenceDate ? date(input.referenceDate, "referenceDate") : operationNow; const access = await currentAccess(input.relationCaseId, input.requesterUserId, operationNow, reader); if (input.objectType === "SOURCE" && !access.permissions.has("VIEW_SOURCES") && !access.sourceResourceIds.has(input.objectId)) throw new GovernedMemoryReadError("NOT_FOUND", "Memory object not found."); const trace = await reader.getObjectTrace(input.relationCaseId, input.objectType, input.objectId, cutoff); const relations = trace.relations.filter((row) => row.sourceType !== "SOURCE" && row.targetType !== "SOURCE" || access.permissions.has("VIEW_SOURCES")); return { relations, validations: trace.validations, disputes: trace.disputes, events: trace.events, limitations: [limitation("POLYMORPHIC_REFERENCE_UNVERIFIED", "RESULT", null, "INFO")] }; });
}
