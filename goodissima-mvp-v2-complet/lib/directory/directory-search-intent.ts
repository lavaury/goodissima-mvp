import { DIRECTORY_ACTOR_TYPES } from "./contracts.ts";
import { DIRECTORY_SEARCH_FILTER_KINDS, type DirectorySearchCriteria, type DirectorySearchFilterKind } from "./directory-search-contracts.ts";
import { normalizeDirectorySearchCriteria } from "./directory-search-service.ts";

const MAX_VALUES = 10;
const MAX_VALUE_LENGTH = 120;
const MAX_UNSUPPORTED = 8;
const allowedKeys = new Set(["actorType", "text", "professions", "skills", "languages", "locations", "qualifications", "certifications", "verificationRequirements", "unsupportedCriteria"]);
const verificationKinds = [...DIRECTORY_SEARCH_FILTER_KINDS, "ORGANIZATION_DOMAIN"] as const;

export type DirectorySearchIntent = {
  actorType?: "PERSON" | "ORGANIZATION";
  text?: string;
  professions?: string[];
  skills?: string[];
  languages?: string[];
  locations?: Array<{ value: string; granularity?: "COUNTRY" | "REGION" | "CITY" }>;
  qualifications?: string[];
  certifications?: string[];
  verificationRequirements?: Array<{ kind: (typeof verificationKinds)[number]; requiredLevel: "VERIFIED" }>;
  unsupportedCriteria?: Array<{ label: string; reason?: string }>;
};

export class DirectorySearchIntentError extends Error {
  readonly code = "DIRECTORY_SEARCH_INTENT_INVALID";
  constructor() { super("DIRECTORY_SEARCH_INTENT_INVALID"); this.name = "DirectorySearchIntentError"; }
}

function invalid(): never { throw new DirectorySearchIntentError(); }
function cleanString(value: unknown, max = MAX_VALUE_LENGTH) {
  if (typeof value !== "string") return invalid();
  const clean = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ");
  if (!clean || clean.length > max) return invalid();
  return clean;
}
function strings(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_VALUES) return invalid();
  return [...new Set(value.map((item) => cleanString(item)))];
}
function strictRecord(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) return invalid();
  return record;
}

export function parseDirectorySearchIntent(input: unknown): DirectorySearchIntent {
  const value = strictRecord(input, [...allowedKeys]);
  if (value.actorType !== undefined && !DIRECTORY_ACTOR_TYPES.includes(value.actorType as never)) return invalid();
  const intent: DirectorySearchIntent = {};
  if (value.actorType) intent.actorType = value.actorType as DirectorySearchIntent["actorType"];
  if (value.text !== undefined) intent.text = cleanString(value.text, 80);
  for (const field of ["professions", "skills", "languages", "qualifications", "certifications"] as const) {
    const parsed = strings(value[field]); if (parsed?.length) intent[field] = parsed;
  }
  if (value.locations !== undefined) {
    if (!Array.isArray(value.locations) || value.locations.length > MAX_VALUES) return invalid();
    intent.locations = value.locations.map((item) => { const row = strictRecord(item, ["value", "granularity"]); if (row.granularity !== undefined && !["COUNTRY", "REGION", "CITY"].includes(String(row.granularity))) return invalid(); return { value: cleanString(row.value), ...(row.granularity ? { granularity: row.granularity as "COUNTRY" | "REGION" | "CITY" } : {}) }; });
  }
  if (value.verificationRequirements !== undefined) {
    if (!Array.isArray(value.verificationRequirements) || value.verificationRequirements.length > verificationKinds.length) return invalid();
    intent.verificationRequirements = value.verificationRequirements.map((item) => { const row = strictRecord(item, ["kind", "requiredLevel"]); if (!verificationKinds.includes(row.kind as never) || row.requiredLevel !== "VERIFIED") return invalid(); return { kind: row.kind as (typeof verificationKinds)[number], requiredLevel: "VERIFIED" as const }; });
  }
  if (value.unsupportedCriteria !== undefined) {
    if (!Array.isArray(value.unsupportedCriteria) || value.unsupportedCriteria.length > MAX_UNSUPPORTED) return invalid();
    intent.unsupportedCriteria = value.unsupportedCriteria.map((item) => { const row = strictRecord(item, ["label", "reason"]); return { label: cleanString(row.label, 160), ...(row.reason === undefined ? {} : { reason: cleanString(row.reason, 240) }) }; });
  }
  return intent;
}

export function directorySearchIntentToCriteria(intent: DirectorySearchIntent): DirectorySearchCriteria | null {
  const candidate: DirectorySearchCriteria = {};
  if (intent.actorType) candidate.actorType = intent.actorType;
  if (intent.text) candidate.text = intent.text;
  for (const field of ["professions", "skills", "languages", "qualifications", "certifications"] as const) if (intent[field]?.length) candidate[field] = intent[field];
  if (intent.locations?.length) candidate.locations = intent.locations.map((item) => item.value);
  const requirements = intent.verificationRequirements?.filter((item): item is { kind: DirectorySearchFilterKind; requiredLevel: "VERIFIED" } => DIRECTORY_SEARCH_FILTER_KINDS.includes(item.kind as DirectorySearchFilterKind));
  if (requirements?.length) candidate.verificationRequirements = requirements.map((item) => ({ kind: item.kind, level: "VERIFIED" }));
  if (!Object.keys(candidate).length) return null;
  normalizeDirectorySearchCriteria(candidate);
  return candidate;
}

export function countDirectorySearchCriteria(criteria: DirectorySearchCriteria | null) {
  if (!criteria) return 0;
  return Object.entries(criteria).reduce((count, [key, value]) => count + (key === "actorType" || key === "text" ? 1 : Array.isArray(value) ? value.length : 0), 0);
}
