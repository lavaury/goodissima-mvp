import type {
  DirectoryAttributeKind,
  DirectoryLocationGranularity,
  DirectoryVerificationLossPolicy,
} from "@prisma/client";
import type {
  DirectoryAttributeWrite,
  DirectoryEnrollmentRepository,
  DirectoryManagedProfileRecord,
} from "./directory-enrollment-repository.ts";

const PERSON_ATTRIBUTE_KINDS = new Set<DirectoryAttributeKind>([
  "PROFESSION",
  "SKILL",
  "LANGUAGE",
  "LOCATION",
  "QUALIFICATION",
  "CERTIFICATION",
]);
const LOCATION_GRANULARITIES = new Set<DirectoryLocationGranularity>(["COUNTRY", "REGION", "CITY"]);
const LOSS_POLICIES = new Set<DirectoryVerificationLossPolicy>(["KEEP_AS_DECLARED", "WITHDRAW"]);
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;

export const DIRECTORY_ENROLLMENT_ERROR_CODES = [
  "DIRECTORY_AUTH_REQUIRED",
  "DIRECTORY_PERSON_IDENTITY_REQUIRED",
  "DIRECTORY_PROFILE_ALREADY_EXISTS",
  "DIRECTORY_PROFILE_NOT_FOUND",
  "DIRECTORY_PERSON_AUTHORITY_REQUIRED",
  "DIRECTORY_OWNER_REQUIRED",
  "DIRECTORY_INVALID_PUBLIC_NAME",
  "DIRECTORY_INVALID_ATTRIBUTE",
  "DIRECTORY_ATTRIBUTE_NOT_FOUND",
  "DIRECTORY_ATTRIBUTE_NOT_DECLARED",
  "DIRECTORY_INVALID_TRANSITION",
  "DIRECTORY_PUBLISHED_ATTRIBUTE_REQUIRED",
] as const;
export type DirectoryEnrollmentErrorCode = (typeof DIRECTORY_ENROLLMENT_ERROR_CODES)[number];

export class DirectoryEnrollmentError extends Error {
  readonly code: DirectoryEnrollmentErrorCode;

  constructor(code: DirectoryEnrollmentErrorCode) {
    super(code);
    this.name = "DirectoryEnrollmentError";
    this.code = code;
  }
}

export type AddDeclaredDirectoryAttributeInput = {
  kind: DirectoryAttributeKind;
  displayValue: string;
  code?: string | null;
  locale?: string | null;
  locationGranularity?: DirectoryLocationGranularity | null;
  verificationLossPolicy?: DirectoryVerificationLossPolicy;
};

export type UpdateDeclaredDirectoryAttributeInput = {
  displayValue?: string;
  code?: string | null;
  locale?: string | null;
  locationGranularity?: DirectoryLocationGranularity | null;
  verificationLossPolicy?: DirectoryVerificationLossPolicy;
};

function requireUserId(userId: string): string {
  const value = userId.trim();
  if (!value) throw new DirectoryEnrollmentError("DIRECTORY_AUTH_REQUIRED");
  return value;
}

function cleanText(value: unknown, min: number, max: number, error: DirectoryEnrollmentErrorCode): string {
  if (typeof value !== "string") throw new DirectoryEnrollmentError(error);
  const cleaned = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (cleaned.length < min || cleaned.length > max) throw new DirectoryEnrollmentError(error);
  return cleaned;
}

export function normalizeDirectoryValue(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
}

function publicName(value: unknown): { display: string; normalized: string } {
  const display = cleanText(value, 2, 120, "DIRECTORY_INVALID_PUBLIC_NAME");
  if (EMAIL_PATTERN.test(display)) throw new DirectoryEnrollmentError("DIRECTORY_INVALID_PUBLIC_NAME");
  return { display, normalized: normalizeDirectoryValue(display) };
}

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return cleanText(value, 1, max, "DIRECTORY_INVALID_ATTRIBUTE");
}

function assertOnlyKeys(input: object, allowed: readonly string[]) {
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new DirectoryEnrollmentError("DIRECTORY_INVALID_ATTRIBUTE");
  }
}

function attributeWrite(input: AddDeclaredDirectoryAttributeInput): DirectoryAttributeWrite {
  assertOnlyKeys(input, ["kind", "displayValue", "code", "locale", "locationGranularity", "verificationLossPolicy"]);
  if (!PERSON_ATTRIBUTE_KINDS.has(input.kind)) throw new DirectoryEnrollmentError("DIRECTORY_INVALID_ATTRIBUTE");
  const displayValue = cleanText(input.displayValue, 1, 160, "DIRECTORY_INVALID_ATTRIBUTE");
  const code = optionalText(input.code, 80);
  const locale = optionalText(input.locale, 35);
  const verificationLossPolicy = input.verificationLossPolicy ?? "KEEP_AS_DECLARED";
  if (!LOSS_POLICIES.has(verificationLossPolicy)) throw new DirectoryEnrollmentError("DIRECTORY_INVALID_ATTRIBUTE");
  const locationGranularity = input.locationGranularity ?? null;
  if (input.kind === "LOCATION") {
    if (!locationGranularity || !LOCATION_GRANULARITIES.has(locationGranularity)) {
      throw new DirectoryEnrollmentError("DIRECTORY_INVALID_ATTRIBUTE");
    }
  } else if (locationGranularity !== null) {
    throw new DirectoryEnrollmentError("DIRECTORY_INVALID_ATTRIBUTE");
  }
  return {
    kind: input.kind,
    displayValue,
    normalizedValue: normalizeDirectoryValue(displayValue),
    code,
    locale,
    locationGranularity,
    verificationLossPolicy,
  };
}

function assertPersonAuthority(profile: DirectoryManagedProfileRecord, userId: string) {
  if (profile.actorType !== "PERSON"
    || profile.subjectIdentityType !== "PERSON"
    || profile.subjectUserId !== userId) {
    throw new DirectoryEnrollmentError("DIRECTORY_PERSON_AUTHORITY_REQUIRED");
  }
}

function assertOwner(profile: DirectoryManagedProfileRecord) {
  if (profile.managerRole !== "OWNER") throw new DirectoryEnrollmentError("DIRECTORY_OWNER_REQUIRED");
}

function isUniqueProfileViolation(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return false;
  const serialized = JSON.stringify("meta" in error ? error.meta : "").toLowerCase();
  return serialized.includes("subjectidentityid") || serialized.includes("directoryprofile_subjectidentityid_key");
}

export class DirectoryEnrollmentService {
  private readonly repository: DirectoryEnrollmentRepository;
  private readonly now: () => Date;

  constructor(repository: DirectoryEnrollmentRepository, now: () => Date = () => new Date()) {
    this.repository = repository;
    this.now = now;
  }

  async createMyDirectoryDraft(userIdInput: string, input: { publicName: string }) {
    const userId = requireUserId(userIdInput);
    assertOnlyKeys(input, ["publicName"]);
    const name = publicName(input.publicName);
    try {
      return await this.repository.transaction(async (repository) => {
        const subject = await repository.findSubjectForUser(userId);
        if (!subject || subject.identityType !== "PERSON") {
          throw new DirectoryEnrollmentError("DIRECTORY_PERSON_IDENTITY_REQUIRED");
        }
        const created = await repository.createDraft({
          identityId: subject.identityId,
          userId,
          publicName: name.display,
          normalizedName: name.normalized,
        });
        return { publicId: created.publicId, status: "DRAFT" as const };
      });
    } catch (error) {
      if (isUniqueProfileViolation(error)) throw new DirectoryEnrollmentError("DIRECTORY_PROFILE_ALREADY_EXISTS");
      throw error;
    }
  }

  async updateMyDirectoryPublicName(userIdInput: string, publicId: string, value: string) {
    const userId = requireUserId(userIdInput);
    const name = publicName(value);
    return this.repository.transaction(async (repository) => {
      const profile = await this.requireManagedPerson(repository, userId, publicId);
      await repository.updateProfileName(profile.id, name.display, name.normalized);
      return { publicId: profile.publicId, publicName: name.display };
    });
  }

  async addMyDeclaredAttribute(userIdInput: string, publicId: string, input: AddDeclaredDirectoryAttributeInput) {
    const userId = requireUserId(userIdInput);
    const write = attributeWrite(input);
    const occurredAt = this.now();
    return this.repository.transaction(async (repository) => {
      const profile = await this.requireManagedPerson(repository, userId, publicId);
      const created = await repository.createAttribute(profile.id, write);
      await repository.createAudit({ profileId: profile.id, actorUserId: userId, action: "ATTRIBUTE_ADDED", attributeId: created.id, attributeKind: write.kind, occurredAt });
      return { publicId: profile.publicId, attributeId: created.id, publicationStatus: "DRAFT" as const, trustLevel: "DECLARED" as const };
    });
  }

  async updateMyDeclaredAttribute(userIdInput: string, publicId: string, attributeId: string, input: UpdateDeclaredDirectoryAttributeInput) {
    const userId = requireUserId(userIdInput);
    assertOnlyKeys(input, ["displayValue", "code", "locale", "locationGranularity", "verificationLossPolicy"]);
    const occurredAt = this.now();
    return this.repository.transaction(async (repository) => {
      const profile = await this.requireManagedPerson(repository, userId, publicId);
      const current = await repository.findOwnedAttribute(profile.id, attributeId);
      if (!current) throw new DirectoryEnrollmentError("DIRECTORY_ATTRIBUTE_NOT_FOUND");
      if (current.declaredTrustLevel !== "DECLARED" || current.hasVerification) {
        throw new DirectoryEnrollmentError("DIRECTORY_ATTRIBUTE_NOT_DECLARED");
      }
      const write = attributeWrite({
        kind: current.kind,
        displayValue: input.displayValue ?? current.displayValue,
        code: input.code === undefined ? current.code : input.code,
        locale: input.locale === undefined ? current.locale : input.locale,
        locationGranularity: input.locationGranularity === undefined ? current.locationGranularity : input.locationGranularity,
        verificationLossPolicy: input.verificationLossPolicy ?? current.verificationLossPolicy,
      });
      const { kind: _kind, ...update } = write;
      await repository.updateAttribute(current.id, update);
      await repository.createAudit({ profileId: profile.id, actorUserId: userId, action: "ATTRIBUTE_UPDATED", attributeId: current.id, attributeKind: current.kind, occurredAt });
      return { publicId: profile.publicId, attributeId: current.id };
    });
  }

  publishMyDirectoryAttribute(userId: string, publicId: string, attributeId: string) {
    return this.transitionAttribute(userId, publicId, attributeId, "PUBLISHED");
  }

  withdrawMyDirectoryAttribute(userId: string, publicId: string, attributeId: string) {
    return this.transitionAttribute(userId, publicId, attributeId, "WITHDRAWN");
  }

  publishMyDirectoryProfile(userId: string, publicId: string) {
    return this.transitionProfile(userId, publicId, "DRAFT", "PROFILE_PUBLISHED");
  }

  disableMyDirectoryProfile(userId: string, publicId: string) {
    return this.transitionProfile(userId, publicId, "PUBLISHED", "PROFILE_DISABLED");
  }

  republishMyDirectoryProfile(userId: string, publicId: string) {
    return this.transitionProfile(userId, publicId, "DISABLED", "PROFILE_REPUBLISHED");
  }

  private async requireManagedPerson(repository: DirectoryEnrollmentRepository, userId: string, publicIdInput: string) {
    const publicId = cleanText(publicIdInput, 1, 120, "DIRECTORY_PROFILE_NOT_FOUND");
    const profile = await repository.findManagedProfile(userId, publicId);
    if (!profile) throw new DirectoryEnrollmentError("DIRECTORY_PROFILE_NOT_FOUND");
    assertPersonAuthority(profile, userId);
    return profile;
  }

  private async transitionAttribute(userIdInput: string, publicId: string, attributeId: string, status: "PUBLISHED" | "WITHDRAWN") {
    const userId = requireUserId(userIdInput);
    const occurredAt = this.now();
    return this.repository.transaction(async (repository) => {
      const profile = await this.requireManagedPerson(repository, userId, publicId);
      const attribute = await repository.findOwnedAttribute(profile.id, attributeId);
      if (!attribute) throw new DirectoryEnrollmentError("DIRECTORY_ATTRIBUTE_NOT_FOUND");
      const allowed = status === "PUBLISHED"
        ? attribute.publicationStatus === "DRAFT" || attribute.publicationStatus === "WITHDRAWN"
        : attribute.publicationStatus === "PUBLISHED";
      if (!allowed) throw new DirectoryEnrollmentError("DIRECTORY_INVALID_TRANSITION");
      await repository.updateAttributePublication({ attributeId: attribute.id, status, at: occurredAt });
      await repository.createAudit({
        profileId: profile.id,
        actorUserId: userId,
        action: status === "PUBLISHED" ? "ATTRIBUTE_PUBLISHED" : "ATTRIBUTE_WITHDRAWN",
        attributeId: attribute.id,
        attributeKind: attribute.kind,
        occurredAt,
      });
      return { publicId: profile.publicId, attributeId: attribute.id, publicationStatus: status };
    });
  }

  private async transitionProfile(
    userIdInput: string,
    publicId: string,
    expectedStatus: "DRAFT" | "PUBLISHED" | "DISABLED",
    action: "PROFILE_PUBLISHED" | "PROFILE_DISABLED" | "PROFILE_REPUBLISHED",
  ) {
    const userId = requireUserId(userIdInput);
    const occurredAt = this.now();
    return this.repository.transaction(async (repository) => {
      const profile = await this.requireManagedPerson(repository, userId, publicId);
      assertOwner(profile);
      if (profile.status !== expectedStatus) throw new DirectoryEnrollmentError("DIRECTORY_INVALID_TRANSITION");
      publicName(profile.publicName);
      if (action !== "PROFILE_DISABLED" && await repository.countPublishedAttributes(profile.id) < 1) {
        throw new DirectoryEnrollmentError("DIRECTORY_PUBLISHED_ATTRIBUTE_REQUIRED");
      }
      const status = action === "PROFILE_DISABLED" ? "DISABLED" : "PUBLISHED";
      await repository.updateProfilePublication({
        profileId: profile.id,
        status,
        at: occurredAt,
        initialConsent: action === "PROFILE_PUBLISHED" && profile.consentedAt === null,
      });
      await repository.createAudit({ profileId: profile.id, actorUserId: userId, action, occurredAt });
      return { publicId: profile.publicId, status };
    });
  }
}
