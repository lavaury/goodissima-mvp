export const OPPORTUNITY_SCHEMA_VERSION = 1 as const;

export const OPPORTUNITY_TYPES = ["OFFER", "NEED"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_DAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
] as const;
export type OpportunityDay = (typeof OPPORTUNITY_DAYS)[number];

export type OpportunityCriteriaV1 = {
  subject: string;
  category?: string;
  locations?: string[];
  availability?: { days?: OpportunityDay[]; timeFrom?: string; timeTo?: string; timezone?: string };
  dateWindow?: { from?: string; to?: string };
  priceRange?: { min?: number; max?: number; currency: string; unit?: string };
  terms?: string[];
};

export type OpportunityRulesV1 = {
  schemaVersion: typeof OPPORTUNITY_SCHEMA_VERSION;
  type: OpportunityType;
  criteria: OpportunityCriteriaV1;
};

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; error: Error };
export type OpportunityParseResult<T> = ParseSuccess<T> | ParseFailure;

const criteriaKeys = new Set(["subject", "category", "locations", "availability", "dateWindow", "priceRange", "terms"]);
const availabilityKeys = new Set(["days", "timeFrom", "timeTo", "timezone"]);
const dateWindowKeys = new Set(["from", "to"]);
const priceRangeKeys = new Set(["min", "max", "currency", "unit"]);
const opportunityKeys = new Set(["schemaVersion", "type", "criteria"]);
const dayValues = new Set<string>(OPPORTUNITY_DAYS);
const typeValues = new Set<string>(OPPORTUNITY_TYPES);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const currencyPattern = /^[A-Z]{3}$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function strictKeys(value: Record<string, unknown>, allowed: Set<string>, label: string) {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw new Error(`${label}.${unknown} is not allowed.`);
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} must contain 1 to ${max} characters.`);
  return value;
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  return value === undefined ? undefined : text(value, label, max);
}

function textList(value: unknown, label: string, maxItems: number, maxLength: number): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} must contain at most ${maxItems} items.`);
  return value.map((item, index) => text(item, `${label}[${index}]`, maxLength));
}

function parseAvailability(value: unknown): OpportunityCriteriaV1["availability"] {
  if (value === undefined) return undefined;
  const input = record(value, "criteria.availability");
  strictKeys(input, availabilityKeys, "criteria.availability");
  let days: OpportunityDay[] | undefined;
  if (input.days !== undefined) {
    if (!Array.isArray(input.days) || input.days.length > 7 || new Set(input.days).size !== input.days.length || input.days.some((day) => typeof day !== "string" || !dayValues.has(day))) {
      throw new Error("criteria.availability.days must contain unique supported days.");
    }
    days = input.days as OpportunityDay[];
  }
  const timeFrom = optionalText(input.timeFrom, "criteria.availability.timeFrom", 5);
  const timeTo = optionalText(input.timeTo, "criteria.availability.timeTo", 5);
  if ((timeFrom && !timePattern.test(timeFrom)) || (timeTo && !timePattern.test(timeTo))) throw new Error("Availability times must use HH:mm.");
  const timezone = optionalText(input.timezone, "criteria.availability.timezone", 64);
  return { ...(days ? { days } : {}), ...(timeFrom ? { timeFrom } : {}), ...(timeTo ? { timeTo } : {}), ...(timezone ? { timezone } : {}) };
}

function parseDateWindow(value: unknown): OpportunityCriteriaV1["dateWindow"] {
  if (value === undefined) return undefined;
  const input = record(value, "criteria.dateWindow");
  strictKeys(input, dateWindowKeys, "criteria.dateWindow");
  const from = optionalText(input.from, "criteria.dateWindow.from", 10);
  const to = optionalText(input.to, "criteria.dateWindow.to", 10);
  if ((from && !datePattern.test(from)) || (to && !datePattern.test(to))) throw new Error("Date window values must use YYYY-MM-DD.");
  if (from && to && from > to) throw new Error("criteria.dateWindow.from must not be after to.");
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

function parsePriceRange(value: unknown): OpportunityCriteriaV1["priceRange"] {
  if (value === undefined) return undefined;
  const input = record(value, "criteria.priceRange");
  strictKeys(input, priceRangeKeys, "criteria.priceRange");
  const boundedNumber = (candidate: unknown, label: string) => {
    if (candidate === undefined) return undefined;
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0 || candidate > 1_000_000_000) throw new Error(`${label} is outside its allowed range.`);
    return candidate;
  };
  const min = boundedNumber(input.min, "criteria.priceRange.min");
  const max = boundedNumber(input.max, "criteria.priceRange.max");
  if (min !== undefined && max !== undefined && min > max) throw new Error("criteria.priceRange.min must not exceed max.");
  const currency = text(input.currency, "criteria.priceRange.currency", 3);
  if (!currencyPattern.test(currency)) throw new Error("criteria.priceRange.currency must be an ISO-style uppercase code.");
  const unit = optionalText(input.unit, "criteria.priceRange.unit", 40);
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), currency, ...(unit ? { unit } : {}) };
}

export function parseOpportunityCriteriaV1(value: unknown): OpportunityCriteriaV1 {
  const input = record(value, "criteria");
  strictKeys(input, criteriaKeys, "criteria");
  const category = optionalText(input.category, "criteria.category", 80);
  const locations = textList(input.locations, "criteria.locations", 10, 120);
  const terms = textList(input.terms, "criteria.terms", 20, 80);
  const availability = parseAvailability(input.availability);
  const dateWindow = parseDateWindow(input.dateWindow);
  const priceRange = parsePriceRange(input.priceRange);
  return {
    subject: text(input.subject, "criteria.subject", 160),
    ...(category ? { category } : {}), ...(locations ? { locations } : {}),
    ...(availability ? { availability } : {}), ...(dateWindow ? { dateWindow } : {}),
    ...(priceRange ? { priceRange } : {}), ...(terms ? { terms } : {}),
  };
}

export function parseOpportunityRulesV1(value: unknown): OpportunityRulesV1 {
  const input = record(value, "opportunity");
  strictKeys(input, opportunityKeys, "opportunity");
  if (input.schemaVersion !== OPPORTUNITY_SCHEMA_VERSION) throw new Error("Unsupported opportunity schemaVersion.");
  if (typeof input.type !== "string" || !typeValues.has(input.type)) throw new Error("Unsupported opportunity type.");
  return { schemaVersion: OPPORTUNITY_SCHEMA_VERSION, type: input.type as OpportunityType, criteria: parseOpportunityCriteriaV1(input.criteria) };
}

export function safeParseOpportunityRulesV1(value: unknown): OpportunityParseResult<OpportunityRulesV1> {
  try { return { success: true, data: parseOpportunityRulesV1(value) }; }
  catch (error) { return { success: false, error: error instanceof Error ? error : new Error("Invalid opportunity metadata.") }; }
}
