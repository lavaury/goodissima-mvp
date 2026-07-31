export const REPRESENTATION_TYPES = [
  "PROFESSIONAL",
  "ORGANIZATION_REPRESENTATIVE",
  "ASSOCIATION",
  "PRIVATE",
  "OTHER",
] as const;

export const REPRESENTATION_STATUSES = ["ACTIVE", "HIDDEN", "ARCHIVED"] as const;

export type RepresentationType = (typeof REPRESENTATION_TYPES)[number];
export type RepresentationStatus = (typeof REPRESENTATION_STATUSES)[number];

export type CreateRepresentationInput = {
  type: RepresentationType;
  displayName: string;
  title?: string | null;
  organizationName?: string | null;
  description?: string | null;
  territory?: string | null;
};

export type UpdateRepresentationInput = Partial<CreateRepresentationInput> & {
  expectedUpdatedAt?: string;
};

export type RepresentationView = {
  id: string;
  type: RepresentationType;
  displayName: string;
  title: string | null;
  organizationName: string | null;
  description: string | null;
  territory: string | null;
  status: RepresentationStatus;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export class DirectoryValidationError extends Error {
  readonly code = "INVALID_REPRESENTATION_PAYLOAD";
  readonly issues: string[];

  constructor(issues: string[]) {
    super("Representation payload is invalid.");
    this.issues = issues;
  }
}

const limits = {
  displayName: 120,
  title: 160,
  organizationName: 160,
  description: 2_000,
  territory: 120,
} as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DirectoryValidationError(["payload must be an object"]);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: "displayName", issues: string[]) {
  if (typeof value !== "string") {
    issues.push(`${field} is required`);
    return "";
  }
  const normalized = value.trim();
  if (!normalized) issues.push(`${field} must not be empty`);
  if (normalized.length > limits[field]) issues.push(`${field} is too long`);
  return normalized;
}

function optionalText(
  value: unknown,
  field: "title" | "organizationName" | "description" | "territory",
  issues: string[],
) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    issues.push(`${field} must be a string or null`);
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) issues.push(`${field} must not be empty when provided`);
  if (normalized.length > limits[field]) issues.push(`${field} is too long`);
  return normalized;
}

function representationType(value: unknown, issues: string[]) {
  if (typeof value !== "string" || !REPRESENTATION_TYPES.includes(value as RepresentationType)) {
    issues.push("type is invalid");
    return "OTHER" as const;
  }
  return value as RepresentationType;
}

function rejectUnknownKeys(input: Record<string, unknown>, allowed: readonly string[], issues: string[]) {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) issues.push(`${key} is not allowed`);
  }
}

export function parseCreateRepresentationInput(value: unknown): CreateRepresentationInput {
  const input = record(value);
  const issues: string[] = [];
  rejectUnknownKeys(input, ["type", "displayName", "title", "organizationName", "description", "territory"], issues);
  const result = {
    type: representationType(input.type, issues),
    displayName: requiredText(input.displayName, "displayName", issues),
    title: optionalText(input.title, "title", issues),
    organizationName: optionalText(input.organizationName, "organizationName", issues),
    description: optionalText(input.description, "description", issues),
    territory: optionalText(input.territory, "territory", issues),
  };
  if (issues.length) throw new DirectoryValidationError(issues);
  return result;
}

export function parseUpdateRepresentationInput(value: unknown): UpdateRepresentationInput {
  const input = record(value);
  const issues: string[] = [];
  rejectUnknownKeys(input, ["type", "displayName", "title", "organizationName", "description", "territory", "expectedUpdatedAt"], issues);
  const result: UpdateRepresentationInput = {};
  if ("type" in input) result.type = representationType(input.type, issues);
  if ("displayName" in input) result.displayName = requiredText(input.displayName, "displayName", issues);
  for (const field of ["title", "organizationName", "description", "territory"] as const) {
    if (field in input) result[field] = optionalText(input[field], field, issues);
  }
  if ("expectedUpdatedAt" in input) {
    if (typeof input.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(input.expectedUpdatedAt))) {
      issues.push("expectedUpdatedAt is invalid");
    } else {
      result.expectedUpdatedAt = input.expectedUpdatedAt;
    }
  }
  if (!Object.keys(result).some((key) => key !== "expectedUpdatedAt")) issues.push("at least one field is required");
  if (issues.length) throw new DirectoryValidationError(issues);
  return result;
}

export function canTransitionRepresentation(from: RepresentationStatus, to: RepresentationStatus) {
  if (from === to) return true;
  if (to === "ARCHIVED") return from === "ACTIVE" || from === "HIDDEN";
  if (to === "HIDDEN") return from === "ACTIVE";
  return to === "ACTIVE" && (from === "HIDDEN" || from === "ARCHIVED");
}

export function representationTransitionPatch(
  current: { status: RepresentationStatus; archivedAt: Date | null },
  target: RepresentationStatus,
  now = new Date(),
) {
  if (!canTransitionRepresentation(current.status, target)) return null;
  if (current.status === target) return {};
  return { status: target, archivedAt: target === "ARCHIVED" ? now : null };
}
