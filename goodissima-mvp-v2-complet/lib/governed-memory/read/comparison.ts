import type { GovernedMemoryChange, GovernedMemoryChangeSet, GovernedMemoryReadResult } from "./types.ts";

const change = (id: string, type: string, changedAt: string, before: unknown, after: unknown, certainty: GovernedMemoryChange["certainty"] = "RECONSTRUCTED"): GovernedMemoryChange => ({ id, type, changedAt, before, after, evidenceRefs: [], certainty });
const mapById = <T extends { id: string }>(values: T[]) => new Map(values.map((value) => [value.id, value]));

export function compareMemoryStates(from: GovernedMemoryReadResult, to: GovernedMemoryReadResult): GovernedMemoryChangeSet {
  const fromFacts = mapById(from.facts); const toFacts = mapById(to.facts);
  const fromDecisions = mapById(from.decisions); const toDecisions = mapById(to.decisions);
  const fromSources = mapById(from.sources); const toSources = mapById(to.sources);
  const fromDisputes = mapById(from.disputes); const toDisputes = mapById(to.disputes);
  const fromAccess = mapById(from.access); const toAccess = mapById(to.access);
  const fromRoles = mapById(from.roles); const toRoles = mapById(to.roles);
  const result: GovernedMemoryChangeSet = { factsAdded: [], factsRemovedFromEffectiveState: [], factsChanged: [], decisionsAdded: [], decisionsSuperseded: [], decisionsCancelled: [], sourcesAdded: [], sourcesRestricted: [], disputesOpened: [], disputesResolved: [], permissionsGranted: [], permissionsRevoked: [], roleAssignmentsChanged: [] };
  for (const value of to.facts) if (!fromFacts.has(value.id)) result.factsAdded.push(change(value.id, "FACT_APPEARED", value.recordedAt, null, value, "EXACT"));
  for (const value of from.facts) if (!toFacts.has(value.id)) result.factsRemovedFromEffectiveState.push(change(value.id, "FACT_BECAME_INAPPLICABLE", to.referenceDate ?? to.generatedAt, value, null));
  for (const value of to.facts) { const before = fromFacts.get(value.id); if (before && (before.statusAtReference !== value.statusAtReference || before.disputeState !== value.disputeState)) result.factsChanged.push(change(value.id, "FACT_STATE_CHANGED", to.referenceDate ?? to.generatedAt, before, value)); }
  for (const value of to.decisions) if (!fromDecisions.has(value.id)) result.decisionsAdded.push(change(value.id, "DECISION_APPEARED", value.recordedAt, null, value, "EXACT"));
  for (const value of to.decisions) { const before = fromDecisions.get(value.id); if (before?.statusAtReference !== "SUPERSEDED" && value.statusAtReference === "SUPERSEDED") result.decisionsSuperseded.push(change(value.id, "DECISION_SUPERSEDED", value.supersession?.recordedAt ?? to.generatedAt, before, value)); if (before?.statusAtReference !== "CANCELLED" && value.statusAtReference === "CANCELLED") result.decisionsCancelled.push(change(value.id, "DECISION_CANCELLED", value.supersession?.recordedAt ?? to.generatedAt, before, value)); }
  for (const value of to.sources) if (!fromSources.has(value.id)) result.sourcesAdded.push(change(value.id, "SOURCE_APPEARED", value.recordedAt, null, value, "EXACT"));
  for (const value of to.sources) { const before = fromSources.get(value.id); if (before && !before.restricted && value.restricted) result.sourcesRestricted.push(change(value.id, "SOURCE_RESTRICTED", to.referenceDate ?? to.generatedAt, before, value)); }
  for (const value of to.disputes) if (!fromDisputes.has(value.id) || fromDisputes.get(value.id)?.statusAtReference !== "OPEN") result.disputesOpened.push(change(value.id, "DISPUTE_OPENED", value.raisedAt, fromDisputes.get(value.id) ?? null, value, "EXACT"));
  for (const value of from.disputes) if (value.statusAtReference === "OPEN" && toDisputes.get(value.id)?.statusAtReference !== "OPEN") result.disputesResolved.push(change(value.id, "DISPUTE_RESOLVED", toDisputes.get(value.id)?.resolvedAt ?? to.generatedAt, value, toDisputes.get(value.id) ?? null));
  for (const value of to.access) if (!fromAccess.has(value.id) && value.stateAtReference === "ACTIVE") result.permissionsGranted.push(change(value.id, "PERMISSION_GRANTED", value.effectiveFrom, null, value, "EXACT"));
  for (const value of to.access) { const before = fromAccess.get(value.id); if (before?.stateAtReference === "ACTIVE" && ["REVOKED", "EXPIRED"].includes(value.stateAtReference)) result.permissionsRevoked.push(change(value.id, value.stateAtReference === "REVOKED" ? "PERMISSION_REVOKED" : "PERMISSION_EXPIRED", value.revokedAt ?? value.effectiveUntil ?? to.generatedAt, before, value, "EXACT")); }
  for (const value of to.roles) { const before = fromRoles.get(value.id); if (!before || before.activeAtReference !== value.activeAtReference) result.roleAssignmentsChanged.push(change(value.id, value.activeAtReference ? "ROLE_ASSIGNED" : "ROLE_REVOKED", value.activeAtReference ? value.assignedAt : value.revokedAt ?? to.generatedAt, before ?? null, value, "EXACT")); }
  return result;
}
