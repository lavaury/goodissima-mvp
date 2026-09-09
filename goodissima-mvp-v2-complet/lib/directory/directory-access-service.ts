import type {
  ManagedDirectoryAttributeDto,
  ManagedDirectoryProfileDto,
  PublishedDirectoryAttributeDto,
  PublishedDirectoryProfileDto,
} from "./contracts.ts";
import type {
  DirectoryAttributeRecord,
  DirectoryRepository,
  ManagedDirectoryProfileRecord,
} from "./directory-repository.ts";

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function isVerificationCurrentlyValid(attribute: DirectoryAttributeRecord, now: Date): boolean {
  const verification = attribute.verification;
  if (attribute.declaredTrustLevel !== "VERIFIED" || !verification) return false;
  if (verification.state !== "VALID" || verification.credential.status !== "ACTIVE") return false;
  if (verification.validUntil && verification.validUntil <= now) return false;
  if (verification.credential.expiresAt && verification.credential.expiresAt <= now) return false;
  return true;
}

function publicAttribute(attribute: DirectoryAttributeRecord, now: Date): PublishedDirectoryAttributeDto {
  return {
    kind: attribute.kind,
    displayValue: attribute.displayValue,
    code: attribute.code,
    locale: attribute.locale,
    locationGranularity: attribute.locationGranularity,
    trustLevel: isVerificationCurrentlyValid(attribute, now) ? "VERIFIED" : "DECLARED",
  };
}

function isAttributePubliclyVisible(attribute: DirectoryAttributeRecord, now: Date): boolean {
  if (attribute.publicationStatus !== "PUBLISHED") return false;
  return attribute.declaredTrustLevel !== "VERIFIED"
    || isVerificationCurrentlyValid(attribute, now)
    || attribute.verificationLossPolicy === "KEEP_AS_DECLARED";
}

function managedAttribute(attribute: DirectoryAttributeRecord, now: Date): ManagedDirectoryAttributeDto {
  return {
    ...publicAttribute(attribute, now),
    publicationStatus: attribute.publicationStatus,
    verificationLossPolicy: attribute.verificationLossPolicy,
  };
}

function hasPersonPublicationAuthority(profile: ManagedDirectoryProfileRecord, userId: string): boolean {
  return profile.actorType === "PERSON"
    && profile.subjectIdentity.type === "PERSON"
    && profile.subjectIdentity.user?.id === userId;
}

export class DirectoryAccessService {
  private readonly repository: DirectoryRepository;
  private readonly now: () => Date;

  constructor(
    repository: DirectoryRepository,
    now: () => Date = () => new Date(),
  ) {
    this.repository = repository;
    this.now = now;
  }

  /** Null is the logical 404 for absent, draft and disabled profiles alike. */
  async getPublishedProfile(publicId: string): Promise<PublishedDirectoryProfileDto | null> {
    const normalizedPublicId = publicId.trim();
    if (!normalizedPublicId) return null;
    const profile = await this.repository.findPublishedByPublicId(normalizedPublicId);
    if (!profile || profile.status !== "PUBLISHED" || !profile.publishedAt) return null;
    const now = this.now();
    return {
      publicId: profile.publicId,
      actorType: profile.actorType,
      publicName: profile.publicName,
      publishedAt: profile.publishedAt.toISOString(),
      attributes: profile.attributes
        .filter((attribute) => isAttributePubliclyVisible(attribute, now))
        .map((attribute) => publicAttribute(attribute, now)),
    };
  }

  async listMyProfiles(userId: string): Promise<ManagedDirectoryProfileDto[]> {
    if (!userId) return [];
    const profiles = await this.repository.listManagedByUserId(userId);
    const now = this.now();
    return profiles.map((profile) => {
      const canPublish = hasPersonPublicationAuthority(profile, userId);
      return {
        publicId: profile.publicId,
        actorType: profile.actorType,
        status: profile.status,
        publicName: profile.publicName,
        consentedAt: iso(profile.consentedAt),
        publishedAt: iso(profile.publishedAt),
        disabledAt: iso(profile.disabledAt),
        canPublish,
        publicationAuthority: canPublish ? "PERSON_IDENTITY_OWNER" : "NOT_ESTABLISHED",
        attributes: profile.attributes.map((attribute) => managedAttribute(attribute, now)),
      };
    });
  }
}
