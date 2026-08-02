import type { GovernedMemoryKnowledgeMode, GovernedMemoryReadInclude } from "@/lib/governed-memory/read/types";

type KnowledgeMode = Extract<GovernedMemoryKnowledgeMode, "KNOWN_AT_DATE" | "CURRENT_KNOWLEDGE_ABOUT_DATE">;
type KnowledgeComparisonMode = Extract<GovernedMemoryKnowledgeMode, "KNOWN_AT_EACH_DATE" | "CURRENT_KNOWLEDGE_ABOUT_PERIOD">;

export class GovernedMemoryHttpValidationError extends Error {
  constructor(message: string) { super(message); this.name = "GovernedMemoryHttpValidationError"; }
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,191}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const INCLUDES = new Set<GovernedMemoryReadInclude>(["FACTS", "DECISIONS", "SOURCES", "DISPUTES", "VALIDATIONS", "TIMELINE", "ACCESS"]);

function exact(query: URLSearchParams, allowed: readonly string[]) {
  const allow = new Set(allowed);
  for (const key of query.keys()) if (!allow.has(key) || query.getAll(key).length !== 1) throw new GovernedMemoryHttpValidationError("Unknown or duplicated query parameter.");
}
export function parseId(value: string, name: string) { if (!ID_PATTERN.test(value)) throw new GovernedMemoryHttpValidationError(`${name} is invalid.`); return value; }
function required(query: URLSearchParams, name: string) { const value = query.get(name); if (value === null || value === "") throw new GovernedMemoryHttpValidationError(`${name} is required.`); return value; }
function iso(value: string, name: string) { if (!ISO_PATTERN.test(value)) throw new GovernedMemoryHttpValidationError(`${name} is invalid.`); const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) throw new GovernedMemoryHttpValidationError(`${name} is invalid.`); return parsed.toISOString(); }
function optionalIso(query: URLSearchParams, name: string) { const value = query.get(name); return value === null ? undefined : iso(value, name); }
function bounded(query: URLSearchParams, name: string, maximum: number, fallback?: number) { const value = query.get(name); if (value === null) return fallback; if (!/^[1-9]\d*$/.test(value)) throw new GovernedMemoryHttpValidationError(`${name} is invalid.`); const parsed = Number(value); if (parsed > maximum) throw new GovernedMemoryHttpValidationError(`${name} exceeds its maximum.`); return parsed; }
function cursor(query: URLSearchParams) { const value = query.get("cursor"); if (value === null) return undefined; if (!/^[A-Za-z0-9_-]{1,2048}$/.test(value)) throw new GovernedMemoryHttpValidationError("cursor is invalid."); return value; }
function includes(query: URLSearchParams, fallback?: GovernedMemoryReadInclude[]) { const value = query.get("include"); if (value === null) return fallback; const values = value.split(","); if (!values.length || values.length > INCLUDES.size || new Set(values).size !== values.length || values.some((item) => !INCLUDES.has(item as GovernedMemoryReadInclude))) throw new GovernedMemoryHttpValidationError("include is invalid."); return values as GovernedMemoryReadInclude[]; }
function mode<T extends string>(value: string, allowed: readonly T[], name: string) { if (!allowed.includes(value as T)) throw new GovernedMemoryHttpValidationError(`${name} is invalid.`); return value as T; }

export function parseStateQuery(query: URLSearchParams) { exact(query, ["referenceDate", "knowledgeMode", "include", "limit", "cursor"]); return { referenceDate: iso(required(query, "referenceDate"), "referenceDate"), knowledgeMode: mode<KnowledgeMode>(required(query, "knowledgeMode"), ["KNOWN_AT_DATE", "CURRENT_KNOWLEDGE_ABOUT_DATE"], "knowledgeMode"), include: includes(query), limit: bounded(query, "limit", 200), cursor: cursor(query) }; }
export function parseCompareQuery(query: URLSearchParams) { exact(query, ["from", "to", "knowledgeMode", "include"]); const from = iso(required(query, "from"), "from"); const to = iso(required(query, "to"), "to"); if (from > to) throw new GovernedMemoryHttpValidationError("Date range is invalid."); return { from, to, knowledgeMode: mode<KnowledgeComparisonMode>(required(query, "knowledgeMode"), ["KNOWN_AT_EACH_DATE", "CURRENT_KNOWLEDGE_ABOUT_PERIOD"], "knowledgeMode"), include: includes(query) }; }
export function parseExplanationQuery(query: URLSearchParams) { exact(query, ["referenceDate"]); return { referenceDate: optionalIso(query, "referenceDate") }; }
export function parseAccessQuery(query: URLSearchParams) { exact(query, ["referenceDate", "subjectUserId", "subjectRepresentationId"]); const subjectUserId = query.get("subjectUserId") ?? undefined; const subjectRepresentationId = query.get("subjectRepresentationId") ?? undefined; if (Number(Boolean(subjectUserId)) + Number(Boolean(subjectRepresentationId)) !== 1) throw new GovernedMemoryHttpValidationError("Exactly one access subject is required."); return { referenceDate: iso(required(query, "referenceDate"), "referenceDate"), subjectUserId: subjectUserId ? parseId(subjectUserId, "subjectUserId") : undefined, subjectRepresentationId: subjectRepresentationId ? parseId(subjectRepresentationId, "subjectRepresentationId") : undefined }; }
export function parseTimelineQuery(query: URLSearchParams) { exact(query, ["from", "to", "limit", "cursor", "include"]); const from = iso(required(query, "from"), "from"); const to = iso(required(query, "to"), "to"); if (from > to) throw new GovernedMemoryHttpValidationError("Date range is invalid."); const requestedIncludes = includes(query, ["TIMELINE"]); if (requestedIncludes?.some((value) => value !== "TIMELINE")) throw new GovernedMemoryHttpValidationError("Timeline include is invalid."); return { from, to, limit: bounded(query, "limit", 200), cursor: cursor(query) }; }
export function parseTraceQuery(query: URLSearchParams) { exact(query, ["referenceDate"]); return { referenceDate: optionalIso(query, "referenceDate") }; }
export function parseObjectType(value: string) { return mode(value, ["FACT", "DECISION", "SOURCE"] as const, "objectType"); }
