import type { GovernedMemoryFactStatus, GovernedMemoryDecisionStatus } from "@prisma/client";
import { filterMemoryReadByCurrentAccess, filterReferencesWithoutLeaks } from "./access-filter.ts";
import { dedupeLimitations, limitation } from "./limitations.ts";
import type { GovernedMemoryReadSnapshot } from "./repository.ts";
import type { GovernedMemoryAccessView, GovernedMemoryDecisionView, GovernedMemoryDisputeView, GovernedMemoryFactView, GovernedMemoryKnowledgeMode, GovernedMemoryReadLimitation, GovernedMemoryReadResult, GovernedMemoryRoleView, GovernedMemoryTimelineItem, GovernedMemoryValidationView } from "./types.ts";
import type { ResolvedMemoryPermissions } from "../persistence/permission-resolver.ts";

type Snapshot = NonNullable<GovernedMemoryReadSnapshot>;
const timing = (recordedAt: Date, reference: Date) => recordedAt <= reference ? "KNOWN_THEN" as const : "RECORDED_LATER" as const;
const disputeAt = (row: Snapshot["disputes"][number], reference: Date) => row.resolvedAt && row.resolvedAt <= reference ? row.status : "OPEN" as const;

function supersessionFor(type: "FACT" | "DECISION", id: string, snapshot: Snapshot, reference: Date) {
  const relation = snapshot.relations.find((row) => row.targetType === type && row.targetId === id && ["REPLACES", "CORRECTS", "CANCELS", "COMPLEMENTS"].includes(row.type));
  if (!relation) return undefined;
  const successor = type === "FACT" ? snapshot.facts.find((row) => row.id === relation.sourceId) : snapshot.decisions.find((row) => row.id === relation.sourceId);
  if (!successor || successor.effectiveFrom > reference) return undefined;
  return { relationType: relation.type as "REPLACES" | "CORRECTS" | "CANCELS" | "COMPLEMENTS", relatedId: relation.sourceId, recordedAt: relation.createdAt.toISOString() };
}

function factStatus(row: Snapshot["facts"][number], snapshot: Snapshot, reference: Date): GovernedMemoryFactStatus {
  const dispute = snapshot.disputes.find((item) => item.targetType === "FACT" && item.targetId === row.id && disputeAt(item, reference) === "OPEN");
  if (dispute) return "DISPUTED";
  if (supersessionFor("FACT", row.id, snapshot, reference)?.relationType === "REPLACES") return "SUPERSEDED";
  if (row.establishedAt && row.establishedAt <= reference) return "ESTABLISHED";
  return "PROPOSED";
}

function decisionStatus(row: Snapshot["decisions"][number], snapshot: Snapshot, reference: Date): GovernedMemoryDecisionStatus {
  const succession = supersessionFor("DECISION", row.id, snapshot, reference);
  if (succession?.relationType === "CANCELS") return "CANCELLED";
  if (succession && succession.relationType !== "COMPLEMENTS") return "SUPERSEDED";
  if (row.validatedAt && row.validatedAt <= reference) return "VALIDATED";
  return "DRAFT";
}

export function buildMemoryState(input: { snapshot: Snapshot; access: ResolvedMemoryPermissions; referenceDate: Date; knowledgeMode: GovernedMemoryKnowledgeMode; generatedAt: Date; limit: number; nextCursor: string | null; includes: ReadonlySet<string> }): GovernedMemoryReadResult {
  const { snapshot, referenceDate } = input;
  const limitations: GovernedMemoryReadLimitation[] = [limitation("POLYMORPHIC_REFERENCE_UNVERIFIED", "RESULT", null, "INFO")];
  const sourceFilter = filterMemoryReadByCurrentAccess(snapshot.sources.slice(0, input.limit), input.access);
  for (const source of sourceFilter.visible) {
    const lifecycleEvents = snapshot.events.filter((event) => event.objectType === "SOURCE" && event.objectId === source.id && event.occurredAt <= referenceDate);
    if (lifecycleEvents.some((event) => event.type === "SOURCE_DELETED")) source.statusAtReference = "DELETED";
    else if (lifecycleEvents.some((event) => event.type === "SOURCE_RESTRICTED")) source.statusAtReference = "RESTRICTED";
    else if (["RESTRICTED", "DELETED"].includes(source.statusAtReference)) source.statusAtReference = "ACTIVE";
    source.knowledgeTiming = new Date(source.recordedAt) <= referenceDate ? "KNOWN_THEN" : "RECORDED_LATER";
    if (source.knowledgeTiming === "RECORDED_LATER") limitations.push(limitation("RETROACTIVE_INFORMATION", "SOURCE", source.id, "INFO"));
    if (!source.available) limitations.push(limitation("SOURCE_UNAVAILABLE", "SOURCE", source.id));
    if (["ARCHIVED", "EXPIRED", "ANONYMIZED", "LEGAL_HOLD"].includes(source.statusAtReference)) limitations.push(limitation("STATUS_HISTORY_INCOMPLETE", "SOURCE", source.id));
  }
  if (sourceFilter.redactions.length) limitations.push(limitation("SOURCE_REDACTED", "SOURCE", null, "MATERIAL"));

  const disputes: GovernedMemoryDisputeView[] = snapshot.disputes.map((row) => ({ id: row.id, targetType: row.targetType, targetId: row.targetId, statusAtReference: disputeAt(row, referenceDate), raisedAt: row.raisedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, reason: row.reason, resolution: row.resolvedAt && row.resolvedAt <= referenceDate ? row.resolution : null }));
  const facts: GovernedMemoryFactView[] = snapshot.facts.slice(0, input.limit).map((row) => {
    const sourceRefs = snapshot.relations.filter((rel) => rel.sourceType === "FACT" && rel.sourceId === row.id && rel.targetType === "SOURCE" && rel.type === "SUPPORTED_BY").map((rel) => ({ type: rel.targetType, id: rel.targetId }));
    const state = disputes.find((item) => item.targetType === "FACT" && item.targetId === row.id)?.statusAtReference ?? "NONE";
    const view: GovernedMemoryFactView = { id: row.id, statement: row.statement, statusAtReference: factStatus(row, snapshot, referenceDate), evidenceLevel: row.evidenceLevel, effectiveFrom: row.effectiveFrom.toISOString(), effectiveUntil: row.effectiveUntil?.toISOString() ?? null, recordedAt: row.recordedAt.toISOString(), knowledgeTiming: timing(row.recordedAt, referenceDate), sourceRefs: filterReferencesWithoutLeaks(sourceRefs, sourceFilter.visibleIds), disputeState: state, supersession: supersessionFor("FACT", row.id, snapshot, referenceDate) };
    if (view.knowledgeTiming === "RECORDED_LATER") limitations.push(limitation("RETROACTIVE_INFORMATION", "FACT", row.id, "INFO"));
    if (state === "OPEN") limitations.push(limitation("OPEN_DISPUTE", "FACT", row.id));
    if (!sourceRefs.length) limitations.push(limitation("SOURCE_NOT_LINKED", "FACT", row.id, "INFO"));
    return view;
  });
  const decisions: GovernedMemoryDecisionView[] = snapshot.decisions.slice(0, input.limit).map((row) => {
    const linked = snapshot.relations.filter((rel) => rel.sourceType === "DECISION" && rel.sourceId === row.id);
    const sourceRefs = linked.filter((rel) => rel.targetType === "SOURCE" && rel.type === "SUPPORTED_BY").map((rel) => ({ type: rel.targetType, id: rel.targetId }));
    const factRefs = linked.filter((rel) => rel.targetType === "FACT" && rel.type === "DERIVED_FROM").map((rel) => ({ type: rel.targetType, id: rel.targetId }));
    const state = disputes.find((item) => item.targetType === "DECISION" && item.targetId === row.id)?.statusAtReference ?? "NONE";
    const view: GovernedMemoryDecisionView = { id: row.id, title: row.title, declaredRationale: row.rationale, statusAtReference: decisionStatus(row, snapshot, referenceDate), decidedByUserId: row.decidedByUserId, validatedByUserId: row.validatedByUserId, decidedAt: row.decidedAt.toISOString(), validatedAt: row.validatedAt?.toISOString() ?? null, effectiveFrom: row.effectiveFrom.toISOString(), effectiveUntil: row.effectiveUntil?.toISOString() ?? null, recordedAt: row.recordedAt.toISOString(), knowledgeTiming: timing(row.recordedAt, referenceDate), sourceRefs: filterReferencesWithoutLeaks(sourceRefs, sourceFilter.visibleIds), factRefs, disputeState: state, supersession: supersessionFor("DECISION", row.id, snapshot, referenceDate), reservations: row.reservations, consequences: row.consequences };
    if (!sourceRefs.length) limitations.push(limitation("SOURCE_NOT_LINKED", "DECISION", row.id, "INFO"));
    if (state === "OPEN") limitations.push(limitation("OPEN_DISPUTE", "DECISION", row.id));
    limitations.push(limitation("CAUSALITY_NOT_ESTABLISHED", "DECISION", row.id, "INFO"));
    return view;
  });
  const validations: GovernedMemoryValidationView[] = snapshot.validations.map((row) => ({ id: row.id, targetType: row.targetType, targetId: row.targetId, validatorUserId: row.validatorUserId, validatorRole: row.validatorRole, decision: row.decision, rationale: row.rationale, reservations: row.reservations, validatedAt: row.validatedAt.toISOString() }));
  const timeline: GovernedMemoryTimelineItem[] = snapshot.events.slice(0, 500).filter((row) => row.objectType !== "SOURCE" || sourceFilter.visibleIds.has(row.objectId)).map((row) => ({ id: row.id, type: row.type, actorType: row.actorType, actorUserId: row.actorUserId, objectType: row.objectType, objectId: row.objectId, occurredAt: row.occurredAt.toISOString(), recordedAt: row.recordedAt.toISOString(), summary: row.summary }));
  const access: GovernedMemoryAccessView[] = snapshot.grants.map((row) => accessView(row, referenceDate));
  const roles: GovernedMemoryRoleView[] = snapshot.roles.map((row) => ({ id: row.id, userId: row.userId, role: row.role, assignedAt: row.assignedAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null, activeAtReference: row.assignedAt <= referenceDate && (!row.revokedAt || row.revokedAt > referenceDate) }));
  if (Object.values(snapshot.truncated).some(Boolean)) limitations.push(limitation("PAGE_LIMIT_REACHED", "RESULT", null, "MATERIAL"));
  if (snapshot.truncated.relations || snapshot.truncated.timeline) limitations.push(limitation("STATUS_HISTORY_INCOMPLETE", "RESULT", null, "MATERIAL"));
  return { relationCaseId: snapshot.memoryCase.id, referenceDate: referenceDate.toISOString(), knowledgeMode: input.knowledgeMode, generatedAt: input.generatedAt.toISOString(), facts: input.includes.has("FACTS") ? facts : [], decisions: input.includes.has("DECISIONS") ? decisions : [], sources: input.includes.has("SOURCES") ? sourceFilter.visible : [], disputes: input.includes.has("DISPUTES") ? disputes.filter((row) => row.statusAtReference === "OPEN") : [], validations: input.includes.has("VALIDATIONS") ? validations : [], timeline: input.includes.has("TIMELINE") ? timeline : [], access: input.includes.has("ACCESS") ? access : [], roles: input.includes.has("ACCESS") ? roles : [], limitations: dedupeLimitations(limitations), redactions: sourceFilter.redactions, pagination: { limit: input.limit, nextCursor: input.nextCursor, hasMore: snapshot.truncated.facts } };
}

export function accessView(row: Snapshot["grants"][number], reference: Date): GovernedMemoryAccessView {
  let state: GovernedMemoryAccessView["stateAtReference"] = "ACTIVE";
  if (row.effectiveFrom > reference) state = "NOT_YET_EFFECTIVE";
  else if (row.revokedAt && row.revokedAt <= reference) state = row.residualPermission && row.residualEffectiveUntil && row.residualEffectiveUntil > reference ? "RESIDUAL" : "REVOKED";
  else if (row.effectiveUntil && row.effectiveUntil <= reference) state = "EXPIRED";
  return { id: row.id, subjectType: row.subjectType, subjectId: row.subjectUserId ?? row.subjectRepresentationId ?? "", permission: state === "RESIDUAL" && row.residualPermission ? row.residualPermission : row.permission, resourceType: row.resourceType, resourceId: row.resourceId, effectiveFrom: row.effectiveFrom.toISOString(), effectiveUntil: row.effectiveUntil?.toISOString() ?? null, revokedAt: row.revokedAt?.toISOString() ?? null, stateAtReference: state };
}
