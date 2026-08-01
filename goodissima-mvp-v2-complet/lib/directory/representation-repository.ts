import type { Prisma, PrismaClient, RepresentationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateRepresentationInput, RepresentationView, UpdateRepresentationInput } from "@/lib/directory/contracts";

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
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
} satisfies Prisma.RepresentationSelect;

export type ConditionalUpdateResult =
  | { outcome: "UPDATED"; representation: RepresentationView }
  | { outcome: "NOT_FOUND" }
  | { outcome: "CONFLICT" };

export type RepresentationRepository = {
  createForOwner(ownerId: string, input: CreateRepresentationInput): Promise<RepresentationView | null>;
  listForOwner(ownerId: string): Promise<RepresentationView[]>;
  findForOwner(ownerId: string, id: string): Promise<RepresentationView | null>;
  updateConditionallyForOwner(
    ownerId: string,
    id: string,
    input: UpdateRepresentationInput & { status?: RepresentationStatus; archivedAt?: Date | null },
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
