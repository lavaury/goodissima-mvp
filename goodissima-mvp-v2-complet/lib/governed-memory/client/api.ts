import type { ComparisonMode, HttpEnvelope, KnowledgeMode, MemoryAccess, MemoryExplanation, MemoryState, MemoryTrace } from "./contracts";
import { MemoryClientError } from "./contracts";
import { memoryQuery } from "./query";

async function get<T>(path: string, signal?: AbortSignal) {
  const response = await fetch(path, { method: "GET", cache: "no-store", credentials: "same-origin", signal, headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as HttpEnvelope<T> | null;
  if (!response.ok || !payload?.ok) { const failure = payload && !payload.ok ? payload : null; throw new MemoryClientError(response.status, failure?.error.code ?? "INTERNAL_ERROR", failure?.meta.requestId ?? null); }
  return payload.data;
}
const base = (caseId: string) => `/api/internal/relation-cases/${encodeURIComponent(caseId)}/governed-memory`;
export const governedMemoryClient = {
  state(caseId: string, input: { referenceDate: string; knowledgeMode: KnowledgeMode }, signal?: AbortSignal) { return get<MemoryState>(`${base(caseId)}/state?${memoryQuery({ ...input, include: "FACTS,DECISIONS,SOURCES,DISPUTES,VALIDATIONS,TIMELINE", limit: 100 })}`, signal); },
  compare(caseId: string, input: { from: string; to: string; knowledgeMode: ComparisonMode }, signal?: AbortSignal) { return get<MemoryState>(`${base(caseId)}/compare?${memoryQuery({ ...input, include: "FACTS,DECISIONS,SOURCES,DISPUTES,ACCESS" })}`, signal); },
  timeline(caseId: string, input: { from: string; to: string; cursor?: string }, signal?: AbortSignal) { return get<Pick<MemoryState, "timeline" | "limitations" | "redactions" | "pagination">>(`${base(caseId)}/timeline?${memoryQuery({ ...input, limit: 50, cursor: input.cursor })}`, signal); },
  explanation(caseId: string, decisionId: string, referenceDate: string, signal?: AbortSignal) { return get<MemoryExplanation>(`${base(caseId)}/decisions/${encodeURIComponent(decisionId)}/explanation?${memoryQuery({ referenceDate })}`, signal); },
  access(caseId: string, referenceDate: string, signal?: AbortSignal) { return get<MemoryAccess>(`${base(caseId)}/access?${memoryQuery({ referenceDate })}`, signal); },
  trace(caseId: string, type: "FACT" | "DECISION" | "SOURCE", id: string, referenceDate: string, signal?: AbortSignal) { return get<MemoryTrace>(`${base(caseId)}/objects/${type}/${encodeURIComponent(id)}/trace?${memoryQuery({ referenceDate })}`, signal); },
};
