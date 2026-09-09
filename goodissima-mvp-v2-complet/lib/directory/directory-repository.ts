import type { Prisma, PrismaClient } from "@prisma/client";

export const directoryVerificationSelect = {
  state: true,
  validUntil: true,
  credential: { select: { status: true, expiresAt: true } },
} satisfies Prisma.DirectoryVerificationProvenanceSelect;

export const directoryAttributeSelect = {
  id: true,
  kind: true,
  displayValue: true,
  normalizedValue: true,
  code: true,
  locale: true,
  locationGranularity: true,
  publicationStatus: true,
  declaredTrustLevel: true,
  verificationLossPolicy: true,
  verification: { select: directoryVerificationSelect },
} satisfies Prisma.DirectoryAttributeSelect;

export type DirectoryAttributeRecord = Prisma.DirectoryAttributeGetPayload<{
  select: typeof directoryAttributeSelect;
}>;

export type PublishedDirectoryProfileRecord = {
  publicId: string;
  actorType: "PERSON" | "ORGANIZATION";
  status: "DRAFT" | "PUBLISHED" | "DISABLED";
  publicName: string;
  publishedAt: Date | null;
  attributes: DirectoryAttributeRecord[];
};

export type ManagedDirectoryProfileRecord = {
  publicId: string;
  actorType: "PERSON" | "ORGANIZATION";
  status: "DRAFT" | "PUBLISHED" | "DISABLED";
  publicName: string;
  consentedAt: Date | null;
  publishedAt: Date | null;
  disabledAt: Date | null;
  subjectIdentity: {
    type: "PERSON" | "ORGANIZATION";
    user: { id: string } | null;
  };
  attributes: DirectoryAttributeRecord[];
};

export type DirectoryRepository = {
  findPublishedByPublicId(publicId: string): Promise<PublishedDirectoryProfileRecord | null>;
  listManagedByUserId(userId: string): Promise<ManagedDirectoryProfileRecord[]>;
};

export class PrismaDirectoryRepository implements DirectoryRepository {
  private readonly client: PrismaClient;

  constructor(client: PrismaClient) {
    this.client = client;
  }

  async findPublishedByPublicId(publicId: string): Promise<PublishedDirectoryProfileRecord | null> {
    return this.client.directoryProfile.findFirst({
      where: { publicId, status: "PUBLISHED" },
      select: {
        publicId: true,
        actorType: true,
        status: true,
        publicName: true,
        publishedAt: true,
        attributes: {
          where: { publicationStatus: "PUBLISHED" },
          select: directoryAttributeSelect,
          orderBy: [{ kind: "asc" }, { normalizedValue: "asc" }],
        },
      },
    });
  }

  async listManagedByUserId(userId: string): Promise<ManagedDirectoryProfileRecord[]> {
    return this.client.directoryProfile.findMany({
      where: { managers: { some: { userId, revokedAt: null } } },
      select: {
        publicId: true,
        actorType: true,
        status: true,
        publicName: true,
        consentedAt: true,
        publishedAt: true,
        disabledAt: true,
        subjectIdentity: {
          select: { type: true, user: { select: { id: true } } },
        },
        attributes: {
          select: directoryAttributeSelect,
          orderBy: [{ kind: "asc" }, { normalizedValue: "asc" }],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { publicId: "asc" }],
    });
  }
}

export function createPrismaDirectoryRepository(client: PrismaClient): DirectoryRepository {
  return new PrismaDirectoryRepository(client);
}
