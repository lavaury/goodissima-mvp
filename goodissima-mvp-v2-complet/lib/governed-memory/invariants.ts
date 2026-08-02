import type { GovernedMemoryObjectRef, GovernedMemoryRelation, GovernedMemoryScope, GovernedMemorySource, GovernedMemorySynthesis } from "./types";

export function sameScope(left: GovernedMemoryScope, right: GovernedMemoryScope): boolean {
  return left.type === "RELATION_CASE" && right.type === "RELATION_CASE" && left.relationCaseId === right.relationCaseId;
}

const ALLOWED_RELATIONS: Readonly<Record<GovernedMemoryRelation["type"], readonly string[]>> = {
  SUPPORTED_BY: ["FACT>SOURCE", "DECISION>SOURCE"],
  DERIVED_FROM: ["DECISION>FACT", "SYNTHESIS>FACT", "SYNTHESIS>DECISION", "SYNTHESIS>SOURCE", "SOURCE>SOURCE"],
  REPLACES: ["FACT>FACT", "DECISION>DECISION", "SYNTHESIS>SYNTHESIS"],
  CORRECTS: ["DECISION>DECISION"],
  CANCELS: ["DECISION>DECISION"],
  COMPLEMENTS: ["DECISION>DECISION"],
  CONTESTS: ["DISPUTE>FACT", "DISPUTE>DECISION", "DISPUTE>SYNTHESIS", "DISPUTE>SOURCE"],
  VALIDATES: ["VALIDATION>FACT", "VALIDATION>DECISION", "VALIDATION>SYNTHESIS", "VALIDATION>SOURCE"],
  SUMMARIZES: ["SYNTHESIS>FACT", "SYNTHESIS>DECISION", "SYNTHESIS>SOURCE", "SYNTHESIS>SYNTHESIS"],
};

export function isAllowedRelation(relation: GovernedMemoryRelation): boolean {
  if (!sameScope(relation.scope, relation.from.scope) || !sameScope(relation.scope, relation.to.scope)) return false;
  if (relation.from.type === relation.to.type && relation.from.id === relation.to.id) return false;
  return ALLOWED_RELATIONS[relation.type].includes(`${relation.from.type}>${relation.to.type}`);
}

export function hasDirectedCycle(edges: readonly { from: string; to: string }[]): boolean {
  const graph = new Map<string, string[]>();
  for (const edge of edges) graph.set(edge.from, [...(graph.get(edge.from) ?? []), edge.to]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) if (visit(next)) return true;
    visiting.delete(node); visited.add(node); return false;
  };
  return [...graph.keys()].some(visit);
}

export function refsStayInScope(scope: GovernedMemoryScope, refs: readonly GovernedMemoryObjectRef[]): boolean {
  return refs.every((ref) => sameScope(scope, ref.scope));
}

export function sourceIsPresentable(source: GovernedMemorySource): boolean {
  return !["DELETED", "ANONYMIZED"].includes(source.status);
}

export function sourceMayBeSecondaryEvidence(source: GovernedMemorySource): boolean {
  return source.kind !== "VALIDATED_SYNTHESIS" || source.primarySourceRefs.length > 0;
}

export function synthesisMayBeUsedAsSource(synthesis: GovernedMemorySynthesis): boolean {
  return synthesis.status === "VALIDATED" && Boolean(synthesis.validatedAt && synthesis.validatedByUserId);
}

export function validationCannotEraseDispute(openDisputeIds: readonly string[], _validationIds: readonly string[]): boolean {
  return openDisputeIds.length > 0;
}
