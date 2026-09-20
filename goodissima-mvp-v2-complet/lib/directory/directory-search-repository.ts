import type { Prisma, PrismaClient } from "@prisma/client";
import { directoryAttributeSelect, type DirectoryAttributeRecord } from "./directory-repository.ts";
import type { DirectoryActorTypeDto } from "./contracts.ts";
import type { DirectorySearchFilterKind } from "./directory-search-contracts.ts";

export type NormalizedDirectorySearchCriteria = {
  actorType?: DirectoryActorTypeDto;
  text?: string;
  filters: Array<{ kind: DirectorySearchFilterKind; values: string[] }>;
  verificationRequirements: DirectorySearchFilterKind[];
  cursor?: string;
  limit: number;
};

export type DirectorySearchProfileRecord = {
  internalId: string;
  publicId: string;
  actorType: DirectoryActorTypeDto;
  publicName: string;
  normalizedName: string;
};

export type DirectorySearchAttributeRecord = DirectoryAttributeRecord & { profileId: string };

export type DirectorySearchRecordsPage = {
  profiles: DirectorySearchProfileRecord[];
  attributes: DirectorySearchAttributeRecord[];
  nextCursor: string | null;
};

export type DirectorySearchRepository = {
  searchPublished(criteria: NormalizedDirectorySearchCriteria, now: Date): Promise<DirectorySearchRecordsPage>;
};

function validVerificationWhere(now: Date): Prisma.DirectoryVerificationProvenanceWhereInput {
  return {
    state: "VALID",
    AND: [
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      { credential: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } },
    ],
  };
}

function effectivelyPublishedAttributeWhere(now: Date): Prisma.DirectoryAttributeWhereInput {
  return {
    publicationStatus: "PUBLISHED",
    OR: [
      { declaredTrustLevel: "DECLARED" },
      { verificationLossPolicy: "KEEP_AS_DECLARED" },
      { declaredTrustLevel: "VERIFIED", verification: { is: validVerificationWhere(now) } },
    ],
  };
}

function verifiedAttributeWhere(kind: DirectorySearchFilterKind, now: Date): Prisma.DirectoryAttributeWhereInput {
  return {
    publicationStatus: "PUBLISHED",
    kind,
    declaredTrustLevel: "VERIFIED",
    verification: { is: validVerificationWhere(now) },
  };
}

export class PrismaDirectorySearchRepository implements DirectorySearchRepository {
  private readonly client: PrismaClient;

  constructor(client: PrismaClient) {
    this.client = client;
  }

  async searchPublished(criteria: NormalizedDirectorySearchCriteria, now: Date): Promise<DirectorySearchRecordsPage> {
    const effectiveAttribute = effectivelyPublishedAttributeWhere(now);
    const and: Prisma.DirectoryProfileWhereInput[] = [];
    if (criteria.text) {
      const contains = criteria.text.replace(/[\\%_]/g, "\\$&");
      and.push({ OR: [
        { normalizedName: { contains, mode: "insensitive" } },
        { attributes: { some: { ...effectiveAttribute, normalizedValue: { contains, mode: "insensitive" } } } },
      ] });
    }
    for (const filter of criteria.filters) {
      and.push({ attributes: { some: { ...effectiveAttribute, kind: filter.kind, normalizedValue: { in: filter.values } } } });
    }
    for (const kind of criteria.verificationRequirements) {
      and.push({ attributes: { some: verifiedAttributeWhere(kind, now) } });
    }

    const rows = await this.client.directoryProfile.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        ...(criteria.actorType ? { actorType: criteria.actorType } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      select: { id: true, publicId: true, actorType: true, publicName: true, normalizedName: true },
      orderBy: [{ normalizedName: "asc" }, { publicId: "asc" }],
      take: criteria.limit + 1,
      ...(criteria.cursor ? { cursor: { publicId: criteria.cursor }, skip: 1 } : {}),
    });
    const selected = rows.slice(0, criteria.limit);
    const attributes = selected.length
      ? await this.client.directoryAttribute.findMany({
          where: { profileId: { in: selected.map((profile) => profile.id) }, publicationStatus: "PUBLISHED" },
          select: { ...directoryAttributeSelect, profileId: true },
          orderBy: [{ profileId: "asc" }, { kind: "asc" }, { normalizedValue: "asc" }],
        })
      : [];
    return {
      profiles: selected.map((profile) => ({
        internalId: profile.id,
        publicId: profile.publicId,
        actorType: profile.actorType,
        publicName: profile.publicName,
        normalizedName: profile.normalizedName,
      })),
      attributes,
      nextCursor: rows.length > criteria.limit ? selected.at(-1)?.publicId ?? null : null,
    };
  }
}

export function createPrismaDirectorySearchRepository(client: PrismaClient): DirectorySearchRepository {
  return new PrismaDirectorySearchRepository(client);
}
