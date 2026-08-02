export const CONTACT_REQUEST_STATUSES = ["PENDING", "ACCEPTED", "REFUSED", "DEFERRED", "CANCELLED", "EXPIRED"] as const;
export const CONTACT_REQUEST_CHANNELS = ["MESSAGE", "VOICE", "VIDEO"] as const;
export type ContactRequestStatus = (typeof CONTACT_REQUEST_STATUSES)[number];
export type ContactRequestChannel = (typeof CONTACT_REQUEST_CHANNELS)[number];

export type CreateContactRequestInput = {
  requesterRepresentationId: string;
  targetRepresentationId: string;
  reason: string;
  channels: ContactRequestChannel[];
  contextType?: string | null;
  contextId?: string | null;
  expiresAt?: string;
};
export type ContactRequestDecisionInput = { expectedUpdatedAt: string; deferredUntil?: string };
export type CancelContactRequestInput = { expectedUpdatedAt: string };
export type ContactRequestSummary = {
  id: string;
  direction: "incoming" | "outgoing";
  source: { id: string; displayName: string; title: string | null; organizationName: string | null };
  target: { id: string; displayName: string; title: string | null; organizationName: string | null };
  reason: string;
  channels: ContactRequestChannel[];
  contextType: string | null;
  contextId: string | null;
  status: ContactRequestStatus;
  expiresAt: Date | null;
  deferredUntil: Date | null;
  decidedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class ContactRequestValidationError extends Error {
  readonly code = "INVALID_CONTACT_REQUEST_PAYLOAD";
  readonly issues: string[];
  constructor(issues: string[]) { super("Contact request payload is invalid."); this.issues = issues; }
}

export function isConfirmedContactRequestCreation(status: number, payload: unknown): payload is { request: { id: string; status: "PENDING" } } {
  if (status !== 201 || !payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const request = (payload as Record<string, unknown>).request;
  return Boolean(request && typeof request === "object" && !Array.isArray(request)
    && typeof (request as Record<string, unknown>).id === "string"
    && (request as Record<string, unknown>).id
    && (request as Record<string, unknown>).status === "PENDING");
}

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContactRequestValidationError(["payload must be an object"]);
  return value as Record<string, unknown>;
}
function unknownKeys(input: Record<string, unknown>, allowed: string[], issues: string[]) {
  for (const key of Object.keys(input)) if (!allowed.includes(key)) issues.push(`${key} is not allowed`);
}
function id(value: unknown, field: string, issues: string[]) {
  if (typeof value !== "string" || !value.trim() || value.length > 191) { issues.push(`${field} is invalid`); return ""; }
  return value.trim();
}
function optionalText(value: unknown, field: string, max: number, issues: string[]) {
  if (value === undefined || value === null) return value as undefined | null;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) { issues.push(`${field} is invalid`); return undefined; }
  return value.trim();
}
function iso(value: unknown, field: string, issues: string[]) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) { issues.push(`${field} is invalid`); return ""; }
  return value;
}

export function parseCreateContactRequestInput(value: unknown): CreateContactRequestInput {
  const input = object(value); const issues: string[] = [];
  unknownKeys(input, ["requesterRepresentationId", "targetRepresentationId", "reason", "channels", "contextType", "contextId", "expiresAt"], issues);
  const requesterRepresentationId = id(input.requesterRepresentationId, "requesterRepresentationId", issues);
  const targetRepresentationId = id(input.targetRepresentationId, "targetRepresentationId", issues);
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 10 || reason.length > 1000) issues.push("reason must contain between 10 and 1000 characters");
  const rawChannels = Array.isArray(input.channels) ? input.channels : [];
  if (rawChannels.length < 1 || rawChannels.length > 3 || rawChannels.some((channel) => typeof channel !== "string" || !CONTACT_REQUEST_CHANNELS.includes(channel as ContactRequestChannel))) issues.push("channels are invalid");
  if (new Set(rawChannels).size !== rawChannels.length) issues.push("channels must be unique");
  const result: CreateContactRequestInput = {
    requesterRepresentationId, targetRepresentationId, reason,
    channels: rawChannels.filter((channel): channel is ContactRequestChannel => CONTACT_REQUEST_CHANNELS.includes(channel as ContactRequestChannel)),
    contextType: optionalText(input.contextType, "contextType", 80, issues),
    contextId: optionalText(input.contextId, "contextId", 191, issues),
  };
  if (input.expiresAt !== undefined) result.expiresAt = iso(input.expiresAt, "expiresAt", issues);
  if (issues.length) throw new ContactRequestValidationError(issues);
  return result;
}

export function parseContactRequestDecisionInput(value: unknown, defer = false): ContactRequestDecisionInput {
  const input = object(value); const issues: string[] = [];
  unknownKeys(input, defer ? ["expectedUpdatedAt", "deferredUntil"] : ["expectedUpdatedAt"], issues);
  const result: ContactRequestDecisionInput = { expectedUpdatedAt: iso(input.expectedUpdatedAt, "expectedUpdatedAt", issues) };
  if (defer) result.deferredUntil = iso(input.deferredUntil, "deferredUntil", issues);
  if (issues.length) throw new ContactRequestValidationError(issues);
  return result;
}

export function parseCancelContactRequestInput(value: unknown): CancelContactRequestInput {
  return parseContactRequestDecisionInput(value);
}

export function contactRequestExpiry(createdAt: Date, requested?: string) {
  const minimum = new Date(createdAt.getTime() + 86_400_000);
  const maximum = new Date(createdAt.getTime() + 90 * 86_400_000);
  const expiry = requested ? new Date(requested) : new Date(createdAt.getTime() + 30 * 86_400_000);
  if (expiry < minimum || expiry > maximum) throw new ContactRequestValidationError(["expiresAt must be between 1 and 90 days after creation"]);
  return expiry;
}

export function deferredDate(now: Date, requested?: string) {
  const date = requested ? new Date(requested) : new Date(NaN);
  if (Number.isNaN(date.getTime()) || date < new Date(now.getTime() + 86_400_000) || date > new Date(now.getTime() + 30 * 86_400_000)) {
    throw new ContactRequestValidationError(["deferredUntil must be between 1 and 30 days from now"]);
  }
  return date;
}
