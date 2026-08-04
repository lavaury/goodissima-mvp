import type { GovernedMemoryReadLimitation, GovernedMemoryReadLimitationCode } from "./types.ts";

const MESSAGES: Record<GovernedMemoryReadLimitationCode, string> = {
  SOURCE_NOT_LINKED: "No explicit supporting source is linked.",
  SOURCE_REDACTED: "A linked source is hidden by current access rules.",
  SOURCE_UNAVAILABLE: "A source is retained historically but is not consultable.",
  PROVENANCE_UNAVAILABLE: "The referenced journey provenance is unavailable.",
  RETROACTIVE_INFORMATION: "This element applies to the reference date but was recorded later.",
  STATUS_HISTORY_INCOMPLETE: "The persisted history does not date every status transition exactly.",
  CAUSALITY_NOT_ESTABLISHED: "Explicit links do not establish causality.",
  ACCESS_NOT_EQUAL_TO_CONSULTATION: "An access grant does not prove consultation.",
  CONSULTATION_LOG_UNAVAILABLE: "No governed consultation log is available.",
  OPEN_DISPUTE: "An open dispute affects this object.",
  INCOMPLETE_TEMPORAL_COVERAGE: "The persisted temporal coverage is incomplete.",
  POLYMORPHIC_REFERENCE_UNVERIFIED: "A polymorphic relation is verified by the application, not by a target foreign key.",
  CURRENT_ACCESS_RESTRICTED: "Current access rules restrict this result.",
  PAGE_LIMIT_REACHED: "The configured page or collection limit was reached.",
};

export function limitation(code: GovernedMemoryReadLimitationCode, scope: GovernedMemoryReadLimitation["scope"] = "RESULT", objectId: string | null = null, severity: GovernedMemoryReadLimitation["severity"] = "WARNING"): GovernedMemoryReadLimitation {
  return { code, scope, objectId, message: MESSAGES[code], severity };
}

export function dedupeLimitations(values: GovernedMemoryReadLimitation[]): GovernedMemoryReadLimitation[] {
  const seen = new Set<string>();
  return values.filter((value) => { const key = `${value.code}:${value.scope}:${value.objectId ?? ""}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
