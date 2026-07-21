export type PilotageSignalKind = "ACTION" | "MATCHING" | "UPCOMING" | "ACCESS" | "RECENT" | "HISTORY";
export type GovernanceAttentionPriority = "HIGH" | "MEDIUM" | "LOW";
export type GovernanceAttentionScope = "GLOBAL" | "PORTFOLIO" | "WORKSPACE";
export type GovernanceAttentionSignal = { type: string; priority: GovernanceAttentionPriority; count: number; scope: GovernanceAttentionScope; scopeId: string | null; label: string; href: string };

type AttentionSourceSignal = { kind: PilotageSignalKind; href: string };
type WorkspaceScopedSignal = { workspaceId: string | null };

const interventionKinds = new Set<PilotageSignalKind>(["ACTION", "MATCHING", "ACCESS"]);
const attentionDefinition: Record<"ACTION" | "MATCHING" | "ACCESS", { type: string; priority: GovernanceAttentionPriority; label: string }> = {
  ACTION: { type: "HUMAN_INTERVENTION_REQUIRED", priority: "HIGH", label: "intervention(s) humaine(s) requise(s)" },
  MATCHING: { type: "MATCHING_REVIEW_REQUIRED", priority: "HIGH", label: "demande(s) avec matching à examiner" },
  ACCESS: { type: "ACCESS_INTERVENTION_REQUIRED", priority: "MEDIUM", label: "accès ou invitation(s) à examiner" },
};

export function isInterventionSignalKind(kind: PilotageSignalKind): kind is "ACTION" | "MATCHING" | "ACCESS" {
  return interventionKinds.has(kind);
}

export function summarizeGovernanceAttention(input: { signals: AttentionSourceSignal[]; scope: GovernanceAttentionScope; scopeId?: string; fallbackHref: string }): GovernanceAttentionSignal[] {
  const byKind = new Map<"ACTION" | "MATCHING" | "ACCESS", AttentionSourceSignal[]>();
  for (const signal of input.signals) {
    if (!isInterventionSignalKind(signal.kind)) continue;
    byKind.set(signal.kind, [...(byKind.get(signal.kind) ?? []), signal]);
  }
  return Array.from(byKind.entries()).map(([kind, signals]) => {
    const definition = attentionDefinition[kind];
    return { type: definition.type, priority: definition.priority, count: signals.length, scope: input.scope, scopeId: input.scopeId ?? null, label: `${signals.length} ${definition.label}`, href: signals.length === 1 && signals[0].href.startsWith("/") ? signals[0].href : input.fallbackHref };
  });
}

export function selectDeterministicMatchingSources(input: { linkMatchingActive: boolean; linkHasUsefulCriteria: boolean; linkCaseCount: number; historicalCaseMatchingCount: number }): Array<"LINK" | "HISTORICAL_CASE"> {
  if (input.linkMatchingActive) return input.linkHasUsefulCriteria ? ["LINK"] : [];
  return Array.from({ length: Math.max(0, input.historicalCaseMatchingCount) }, () => "HISTORICAL_CASE" as const);
}

export function filterSignalsByWorkspaceId<T extends WorkspaceScopedSignal>(signals: T[], workspaceId: string): T[] {
  return signals.filter((signal) => signal.workspaceId === workspaceId);
}

export function toGovernanceAIAttention(signals: GovernanceAttentionSignal[]) {
  return signals.map(({ type, priority, count, scope }) => ({ type, priority, count, scope }));
}
