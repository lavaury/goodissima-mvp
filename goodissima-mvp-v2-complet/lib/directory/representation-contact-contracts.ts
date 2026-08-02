export const REPRESENTATION_CONTACT_STATUSES = ["ACTIVE", "ARCHIVED", "REVOKED"] as const;
export type RepresentationContactStatus = (typeof REPRESENTATION_CONTACT_STATUSES)[number];

export type ContactSummary = {
  id: string;
  localRepresentation: { id: string; displayName: string };
  remoteRepresentation: {
    id: string;
    displayName: string;
    type: string;
    title: string | null;
    organizationName: string | null;
    territory: string | null;
    description: string | null;
    relationshipPolicy: string;
  };
  source: { kind: "ACCEPTED_CONTACT_REQUEST"; requestId: string };
  status: RepresentationContactStatus;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type CreateContactFromRequestInput = { expectedUpdatedAt: string };
export type ArchiveContactInput = { expectedUpdatedAt: string };
export type RestoreContactInput = { expectedUpdatedAt: string };

export class RepresentationContactValidationError extends Error {
  readonly code = "INVALID_REPRESENTATION_CONTACT_PAYLOAD";
  readonly issues: string[];
  constructor(issues: string[]) { super("Representation contact payload is invalid."); this.issues = issues; }
}

function expectedVersion(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RepresentationContactValidationError(["payload must be an object"]);
  const input = value as Record<string, unknown>;
  const issues: string[] = [];
  for (const key of Object.keys(input)) if (key !== "expectedUpdatedAt") issues.push(`${key} is not allowed`);
  if (typeof input.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(input.expectedUpdatedAt))) issues.push("expectedUpdatedAt is invalid");
  if (issues.length) throw new RepresentationContactValidationError(issues);
  return { expectedUpdatedAt: input.expectedUpdatedAt as string };
}

export const parseCreateContactFromRequestInput = expectedVersion;
export const parseArchiveContactInput = expectedVersion;
export const parseRestoreContactInput = expectedVersion;
