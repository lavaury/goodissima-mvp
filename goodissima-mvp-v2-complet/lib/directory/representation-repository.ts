import type { Prisma, PrismaClient, RepresentationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateRepresentationInput, PublicDirectoryQuery, PublicDirectoryResult, RepresentationView, UpdateRepresentationInput, RepresentationVisibility } from "@/lib/directory/contracts";

type DirectoryDatabase = PrismaClient | Prisma.TransactionClient;

const representationSelect = {
  id: true,
  type: true,
  displayName: true,
  title: true,
  organizationName: true,
  description: true,
  territory: true,
  status: true,
  relationshipPolicy: true,
  visibility: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
} satisfies Prisma.RepresentationSelect;

const publicRepresentationSelect = {
  id: true,
  displayName: true,
  type: true,
  title: true,
  organizationName: true,
  description: true,
  territory: true,
  relationshipPolicy: true,
  publishedAt: true,
} satisfies Prisma.RepresentationSelect;

export type ConditionalUpdateResult =
  | { outcome: "UPDATED"; representation: RepresentationView }
  | { outcome: "NOT_FOUND" }
  | { outcome: "CONFLICT" };

export type RepresentationRepository = {
  createForOwner(ownerId: string, input: CreateRepresentationInput): Promise<RepresentationView | null>;
  listForOwner(ownerId: string): Promise<RepresentationView[]>;
  findForOwner(ownerId: string, id: string): Promise<RepresentationView | null>;
  listDiscoverableRepresentations(query: PublicDirectoryQuery, limit: number): Promise<PublicDirectoryResult>;
  updateConditionallyForOwner(
    ownerId: string,
    id: string,
    input: UpdateRepresentationInput & { status?: RepresentationStatus; archivedAt?: Date | null; visibility?: RepresentationVisibility; publishedAt?: Date | null },
  ): Promise<ConditionalUpdateResult>;
};

export function createRepresentationRepository(database: DirectoryDatabase = prisma): RepresentationRepository {
  return {
    async createForOwner(ownerId, input) {
      const owner = await database.user.findFirst({
        where: { id: ownerId, goodissimaIdentityId: { not: null } },
        select: { goodissimaIdentityId: true },
      });
      if (!owner?.goodissimaIdentityId) return null;
      return database.representation.create({
        data: {
          ownerId,
          identityId: owner.goodissimaIdentityId,
          type: input.type,
          displayName: input.displayName,
          title: input.title ?? null,
          organizationName: input.organizationName ?? null,
          description: input.description ?? null,
          territory: input.territory ?? null,
          status: "ACTIVE",
          relationshipPolicy: "OPEN",
          visibility: "PRIVATE",
          publishedAt: null,
          archivedAt: null,
        },
        select: representationSelect,
      });
    },

    listForOwner(ownerId) {
      return database.representation.findMany({
        where: { ownerId },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: representationSelect,
      });
    },

    findForOwner(ownerId, id) {
      return database.representation.findFirst({ where: { id, ownerId }, select: representationSelect });
    },

    async listDiscoverableRepresentations(query, limit) {
      const safeLimit = Math.max(1, Math.min(limit, 50));
      const representations = await database.representation.findMany({
        where: {
          status: "ACTIVE",
          visibility: "DISCOVERABLE",
          publishedAt: { not: null },
          ...(query.type ? { type: query.type } : {}),
          ...(query.relationshipPolicy ? { relationshipPolicy: query.relationshipPolicy } : {}),
          ...(query.territory ? { territory: { contains: query.territory, mode: "insensitive" } } : {}),
          ...(query.q ? {
            OR: ["displayName", "title", "organizationName", "description", "territory"].map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" },
            })),
          } : {}),
        },
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        take: safeLimit + 1,
        select: publicRepresentationSelect,
      });
      return {
        items: representations.slice(0, safeLimit).map((representation) => ({ ...representation, publishedAt: representation.publishedAt! })),
        limitReached: representations.length > safeLimit,
      };
    },

    async updateConditionallyForOwner(ownerId, id, input) {
      const current = await database.representation.findFirst({ where: { id, ownerId }, select: { id: true } });
      if (!current) return { outcome: "NOT_FOUND" };
      const { expectedUpdatedAt, ...data } = input;
      const updated = await database.representation.updateMany({
        where: {
          id,
          ownerId,
          ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}),
        },
        data,
      });
      if (updated.count !== 1) return { outcome: "CONFLICT" };
      const representation = await database.representation.findFirst({ where: { id, ownerId }, select: representationSelect });
      return representation ? { outcome: "UPDATED", representation } : { outcome: "CONFLICT" };
    },
  };
}

export const representationRepository = createRepresentationRepository();
