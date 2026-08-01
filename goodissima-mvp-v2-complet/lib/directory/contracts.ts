export const REPRESENTATION_TYPES = [
  "PROFESSIONAL",
  "ORGANIZATION_REPRESENTATIVE",
  "ASSOCIATION",
  "PRIVATE",
  "OTHER",
] as const;

export const REPRESENTATION_STATUSES = ["ACTIVE", "HIDDEN", "ARCHIVED"] as const;
export const REPRESENTATION_RELATIONSHIP_POLICIES = ["OPEN", "MESSAGE_ONLY", "CLOSED"] as const;
export const REPRESENTATION_VISIBILITIES = ["PRIVATE", "DISCOVERABLE"] as const;

export type RepresentationType = (typeof REPRESENTATION_TYPES)[number];
export type RepresentationStatus = (typeof REPRESENTATION_STATUSES)[number];
export type RepresentationRelationshipPolicy = (typeof REPRESENTATION_RELATIONSHIP_POLICIES)[number];
export type RepresentationVisibility = (typeof REPRESENTATION_VISIBILITIES)[number];

export const representationRelationshipPolicyLabels: Record<RepresentationRelationshipPolicy, string> = {
  OPEN: "Ouvert",
  MESSAGE_ONLY: "Messagerie uniquement",
  CLOSED: "Fermé",
};

export const representationRelationshipPolicyDescriptions: Record<RepresentationRelationshipPolicy, string> = {
  OPEN: "Vous acceptez de nouvelles demandes sur les canaux qui seront activés ultérieurement.",
  MESSAGE_ONLY: "Seules les demandes de message seront autorisées.",
  CLOSED: "Aucune nouvelle demande relationnelle ne sera acceptée.",
};

export const representationVisibilityLabels: Record<RepresentationVisibility, string> = {
  PRIVATE: "Privée",
  DISCOVERABLE: "Visible dans l’Annuaire",
};

export const representationVisibilityDescriptions: Record<RepresentationVisibility, string> = {
  PRIVATE: "Cette représentation n’apparaît pas dans l’Annuaire global.",
  DISCOVERABLE: "Les informations publiques de cette représentation peuvent apparaître dans l’Annuaire global. Aucune coordonnée personnelle n’est affichée.",
};

export type CreateRepresentationInput = {
  type: RepresentationType;
  displayName: string;
  title?: string | null;
  organizationName?: string | null;
  description?: string | null;
  territory?: string | null;
};

export type UpdateRepresentationInput = Partial<CreateRepresentationInput> & {
  relationshipPolicy?: RepresentationRelationshipPolicy;
  expectedUpdatedAt?: string;
};

export type SetRelationshipPolicyInput = {
  relationshipPolicy: RepresentationRelationshipPolicy;
  expectedUpdatedAt?: string;
};

export type SetRepresentationVisibilityInput = {
  visibility: RepresentationVisibility;
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
  relationshipPolicy: RepresentationRelationshipPolicy;
  visibility: RepresentationVisibility;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type PublicRepresentationSummary = {
  id: string;
  displayName: string;
  type: RepresentationType;
  title: string | null;
  organizationName: string | null;
  description: string | null;
  territory: string | null;
  relationshipPolicy: RepresentationRelationshipPolicy;
  publishedAt: Date;
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

function relationshipPolicy(value: unknown, issues: string[]) {
  if (typeof value !== "string" || !REPRESENTATION_RELATIONSHIP_POLICIES.includes(value as RepresentationRelationshipPolicy)) {
    issues.push("relationshipPolicy is invalid");
    return "OPEN" as const;
  }
  return value as RepresentationRelationshipPolicy;
}

function visibility(value: unknown, issues: string[]) {
  if (typeof value !== "string" || !REPRESENTATION_VISIBILITIES.includes(value as RepresentationVisibility)) {
    issues.push("visibility is invalid");
    return "PRIVATE" as const;
  }
  return value as RepresentationVisibility;
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
  rejectUnknownKeys(input, ["type", "displayName", "title", "organizationName", "description", "territory", "relationshipPolicy", "expectedUpdatedAt"], issues);
  const result: UpdateRepresentationInput = {};
  if ("type" in input) result.type = representationType(input.type, issues);
  if ("displayName" in input) result.displayName = requiredText(input.displayName, "displayName", issues);
  for (const field of ["title", "organizationName", "description", "territory"] as const) {
    if (field in input) result[field] = optionalText(input[field], field, issues);
  }
  if ("relationshipPolicy" in input) result.relationshipPolicy = relationshipPolicy(input.relationshipPolicy, issues);
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
export function parseSetRelationshipPolicyInput(value: unknown): SetRelationshipPolicyInput {
  const input = record(value);
  const issues: string[] = [];
  rejectUnknownKeys(input, ["relationshipPolicy", "expectedUpdatedAt"], issues);
  const result: SetRelationshipPolicyInput = { relationshipPolicy: relationshipPolicy(input.relationshipPolicy, issues) };
  if ("expectedUpdatedAt" in input) {
    if (typeof input.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(input.expectedUpdatedAt))) issues.push("expectedUpdatedAt is invalid");
    else result.expectedUpdatedAt = input.expectedUpdatedAt;
  }
  if (issues.length) throw new DirectoryValidationError(issues);
  return result;
}

export function parseSetRepresentationVisibilityInput(value: unknown): SetRepresentationVisibilityInput {
  const input = record(value);
  const issues: string[] = [];
  rejectUnknownKeys(input, ["visibility", "expectedUpdatedAt"], issues);
  const result: SetRepresentationVisibilityInput = { visibility: visibility(input.visibility, issues) };
  if ("expectedUpdatedAt" in input) {
    if (typeof input.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(input.expectedUpdatedAt))) issues.push("expectedUpdatedAt is invalid");
    else result.expectedUpdatedAt = input.expectedUpdatedAt;
  }
  if (issues.length) throw new DirectoryValidationError(issues);
  return result;
}

export function representationVisibilityPatch(
  current: { status: RepresentationStatus; visibility: RepresentationVisibility; publishedAt: Date | null },
  target: RepresentationVisibility,
  now = new Date(),
) {
  if (target === "DISCOVERABLE") {
    if (current.status !== "ACTIVE") return null;
    if (current.visibility === "DISCOVERABLE" && current.publishedAt) return {};
    return { visibility: "DISCOVERABLE" as const, publishedAt: now };
  }
  if (current.visibility === "PRIVATE" && current.publishedAt === null) return {};
  return { visibility: "PRIVATE" as const, publishedAt: null };
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
  return {
    status: target,
    archivedAt: target === "ARCHIVED" ? now : null,
    visibility: "PRIVATE" as const,
    publishedAt: null,
  };
}
