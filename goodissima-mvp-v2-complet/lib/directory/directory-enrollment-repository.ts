import type {
  DirectoryActorType,
  DirectoryAttributeKind,
  DirectoryLocationGranularity,
  DirectoryManagerRole,
  DirectoryProfileStatus,
  DirectoryPublicationStatus,
  DirectoryVerificationLossPolicy,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export type DirectorySubjectRecord = {
  identityId: string;
  identityType: "PERSON" | "ORGANIZATION";
};

export type DirectoryManagedProfileRecord = {
  id: string;
  publicId: string;
  actorType: DirectoryActorType;
  status: DirectoryProfileStatus;
  publicName: string;
  consentedAt: Date | null;
  managerRole: DirectoryManagerRole;
  subjectIdentityType: "PERSON" | "ORGANIZATION";
  subjectUserId: string | null;
};

export type DirectoryOwnedAttributeRecord = {
  id: string;
  profileId: string;
  kind: DirectoryAttributeKind;
  displayValue: string;
  normalizedValue: string;
  code: string | null;
  locale: string | null;
  locationGranularity: DirectoryLocationGranularity | null;
  publicationStatus: DirectoryPublicationStatus;
  declaredTrustLevel: "DECLARED" | "VERIFIED";
  verificationLossPolicy: DirectoryVerificationLossPolicy;
  hasVerification: boolean;
};

export type DirectoryAttributeWrite = {
  kind: DirectoryAttributeKind;
  displayValue: string;
  normalizedValue: string;
  code: string | null;
  locale: string | null;
  locationGranularity: DirectoryLocationGranularity | null;
  verificationLossPolicy: DirectoryVerificationLossPolicy;
};

export type DirectoryEnrollmentRepository = {
  transaction<T>(operation: (repository: DirectoryEnrollmentRepository) => Promise<T>): Promise<T>;
  findSubjectForUser(userId: string): Promise<DirectorySubjectRecord | null>;
  findManagedProfile(userId: string, publicId: string): Promise<DirectoryManagedProfileRecord | null>;
  findOwnedAttribute(profileId: string, attributeId: string): Promise<DirectoryOwnedAttributeRecord | null>;
  countPublishedAttributes(profileId: string): Promise<number>;
  createDraft(input: { identityId: string; userId: string; publicName: string; normalizedName: string }): Promise<{ publicId: string }>;
  updateProfileName(profileId: string, publicName: string, normalizedName: string): Promise<void>;
  createAttribute(profileId: string, input: DirectoryAttributeWrite): Promise<{ id: string }>;
  updateAttribute(attributeId: string, input: Omit<DirectoryAttributeWrite, "kind">): Promise<void>;
  updateAttributePublication(input: { attributeId: string; status: "PUBLISHED" | "WITHDRAWN"; at: Date }): Promise<void>;
  updateProfilePublication(input: { profileId: string; status: "PUBLISHED" | "DISABLED"; at: Date; initialConsent: boolean }): Promise<void>;
  createAudit(input: {
    profileId: string;
    actorUserId: string;
    action:
      | "PROFILE_CREATED"
      | "PROFILE_PUBLISHED"
      | "PROFILE_DISABLED"
      | "PROFILE_REPUBLISHED"
      | "ATTRIBUTE_ADDED"
      | "ATTRIBUTE_PUBLISHED"
      | "ATTRIBUTE_UPDATED"
      | "ATTRIBUTE_WITHDRAWN";
    attributeId?: string;
    attributeKind?: DirectoryAttributeKind;
    occurredAt: Date;
  }): Promise<void>;
};

type DirectoryPrismaClient = PrismaClient | Prisma.TransactionClient;

export class PrismaDirectoryEnrollmentRepository implements DirectoryEnrollmentRepository {
  private readonly client: DirectoryPrismaClient;

  constructor(client: DirectoryPrismaClient) {
    this.client = client;
  }

  async transaction<T>(operation: (repository: DirectoryEnrollmentRepository) => Promise<T>): Promise<T> {
    if ("$transaction" in this.client) {
      return this.client.$transaction(
        (tx) => operation(new PrismaDirectoryEnrollmentRepository(tx)),
        { isolationLevel: "Serializable" },
      );
    }
    return operation(this);
  }

  async findSubjectForUser(userId: string): Promise<DirectorySubjectRecord | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: { goodissimaIdentity: { select: { id: true, type: true } } },
    });
    return user?.goodissimaIdentity
      ? { identityId: user.goodissimaIdentity.id, identityType: user.goodissimaIdentity.type }
      : null;
  }

  async findManagedProfile(userId: string, publicId: string): Promise<DirectoryManagedProfileRecord | null> {
    const profile = await this.client.directoryProfile.findFirst({
      where: { publicId, deletedAt: null, managers: { some: { userId, revokedAt: null } } },
      select: {
        id: true,
        publicId: true,
        actorType: true,
        status: true,
        publicName: true,
        consentedAt: true,
        managers: { where: { userId, revokedAt: null }, take: 1, select: { role: true } },
        subjectIdentity: { select: { type: true, user: { select: { id: true } } } },
      },
    });
    const manager = profile?.managers[0];
    if (!profile || !manager) return null;
    return {
      id: profile.id,
      publicId: profile.publicId,
      actorType: profile.actorType,
      status: profile.status,
      publicName: profile.publicName,
      consentedAt: profile.consentedAt,
      managerRole: manager.role,
      subjectIdentityType: profile.subjectIdentity.type,
      subjectUserId: profile.subjectIdentity.user?.id ?? null,
    };
  }

  async findOwnedAttribute(profileId: string, attributeId: string): Promise<DirectoryOwnedAttributeRecord | null> {
    const attribute = await this.client.directoryAttribute.findFirst({
      where: { id: attributeId, profileId },
      select: {
        id: true,
        profileId: true,
        kind: true,
        displayValue: true,
        normalizedValue: true,
        code: true,
        locale: true,
        locationGranularity: true,
        publicationStatus: true,
        declaredTrustLevel: true,
        verificationLossPolicy: true,
        verification: { select: { id: true } },
      },
    });
    if (!attribute) return null;
    return {
      id: attribute.id,
      profileId: attribute.profileId,
      kind: attribute.kind,
      displayValue: attribute.displayValue,
      normalizedValue: attribute.normalizedValue,
      code: attribute.code,
      locale: attribute.locale,
      locationGranularity: attribute.locationGranularity,
      publicationStatus: attribute.publicationStatus,
      declaredTrustLevel: attribute.declaredTrustLevel,
      verificationLossPolicy: attribute.verificationLossPolicy,
      hasVerification: Boolean(attribute.verification),
    };
  }

  countPublishedAttributes(profileId: string): Promise<number> {
    return this.client.directoryAttribute.count({ where: { profileId, publicationStatus: "PUBLISHED" } });
  }

  async createDraft(input: { identityId: string; userId: string; publicName: string; normalizedName: string }) {
    return this.client.directoryProfile.create({
      data: {
        subjectIdentityId: input.identityId,
        actorType: "PERSON",
        status: "DRAFT",
        publicName: input.publicName,
        normalizedName: input.normalizedName,
        managers: { create: { userId: input.userId, role: "OWNER" } },
        auditEvents: { create: { actorUserId: input.userId, action: "PROFILE_CREATED" } },
      },
      select: { publicId: true },
    });
  }

  async updateProfileName(profileId: string, publicName: string, normalizedName: string) {
    await this.client.directoryProfile.update({ where: { id: profileId }, data: { publicName, normalizedName } });
  }

  async createAttribute(profileId: string, input: DirectoryAttributeWrite) {
    return this.client.directoryAttribute.create({
      data: {
        profileId,
        ...input,
        declaredTrustLevel: "DECLARED",
        publicationStatus: "DRAFT",
      },
      select: { id: true },
    });
  }

  async updateAttribute(attributeId: string, input: Omit<DirectoryAttributeWrite, "kind">) {
    await this.client.directoryAttribute.update({ where: { id: attributeId }, data: input });
  }

  async updateAttributePublication(input: { attributeId: string; status: "PUBLISHED" | "WITHDRAWN"; at: Date }) {
    await this.client.directoryAttribute.update({
      where: { id: input.attributeId },
      data: input.status === "PUBLISHED"
        ? { publicationStatus: "PUBLISHED", publishedAt: input.at, withdrawnAt: null }
        : { publicationStatus: "WITHDRAWN", withdrawnAt: input.at },
    });
  }

  async updateProfilePublication(input: { profileId: string; status: "PUBLISHED" | "DISABLED"; at: Date; initialConsent: boolean }) {
    await this.client.directoryProfile.update({
      where: { id: input.profileId },
      data: input.status === "DISABLED"
        ? { status: "DISABLED", disabledAt: input.at }
        : {
            status: "PUBLISHED",
            publishedAt: input.at,
            disabledAt: null,
            ...(input.initialConsent ? { consentedAt: input.at } : {}),
          },
    });
  }

  async createAudit(input: {
    profileId: string;
    actorUserId: string;
    action: "PROFILE_CREATED" | "PROFILE_PUBLISHED" | "PROFILE_DISABLED" | "PROFILE_REPUBLISHED" | "ATTRIBUTE_ADDED" | "ATTRIBUTE_PUBLISHED" | "ATTRIBUTE_UPDATED" | "ATTRIBUTE_WITHDRAWN";
    attributeId?: string;
    attributeKind?: DirectoryAttributeKind;
    occurredAt: Date;
  }) {
    await this.client.directoryAuditEvent.create({ data: input });
  }
}

export function createPrismaDirectoryEnrollmentRepository(client: PrismaClient): DirectoryEnrollmentRepository {
  return new PrismaDirectoryEnrollmentRepository(client);
}
