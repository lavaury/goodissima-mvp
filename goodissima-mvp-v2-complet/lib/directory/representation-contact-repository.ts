import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ContactSummary } from "@/lib/directory/representation-contact-contracts";

type Db = PrismaClient;
const localRepresentationSelect = { id: true, displayName: true } satisfies Prisma.RepresentationSelect;
const contactSelect = {
  id: true, sourceContactRequestId: true, status: true, createdAt: true, updatedAt: true, archivedAt: true,
  snapshotDisplayName: true, snapshotType: true, snapshotTitle: true, snapshotOrganizationName: true,
  snapshotTerritory: true, snapshotDescription: true, snapshotRelationshipPolicy: true,
  contactRepresentationId: true, ownerRepresentation: { select: localRepresentationSelect },
} satisfies Prisma.RepresentationContactSelect;
const snapshotSelect = {
  id: true, displayName: true, type: true, title: true, organizationName: true, territory: true,
  description: true, relationshipPolicy: true,
} satisfies Prisma.RepresentationSelect;

type ContactRow = Prisma.RepresentationContactGetPayload<{ select: typeof contactSelect }>;
function summary(row: ContactRow): ContactSummary {
  return {
    id: row.id, localRepresentation: row.ownerRepresentation,
    remoteRepresentation: { id: row.contactRepresentationId, displayName: row.snapshotDisplayName, type: row.snapshotType,
      title: row.snapshotTitle, organizationName: row.snapshotOrganizationName, territory: row.snapshotTerritory,
      description: row.snapshotDescription, relationshipPolicy: row.snapshotRelationshipPolicy },
    source: { kind: "ACCEPTED_CONTACT_REQUEST", requestId: row.sourceContactRequestId }, status: row.status,
    createdAt: row.createdAt, updatedAt: row.updatedAt, archivedAt: row.archivedAt,
  };
}
function snapshot(remote: Prisma.RepresentationGetPayload<{ select: typeof snapshotSelect }>) {
  return { snapshotDisplayName: remote.displayName, snapshotType: remote.type, snapshotTitle: remote.title,
    snapshotOrganizationName: remote.organizationName, snapshotTerritory: remote.territory,
    snapshotDescription: remote.description, snapshotRelationshipPolicy: remote.relationshipPolicy };
}

export type RepresentationContactRepository = ReturnType<typeof createRepresentationContactRepository>;
export function createRepresentationContactRepository(database: Db = prisma) {
  return {
    async createPairFromAcceptedRequest(actorOwnerId: string, requestId: string, expectedUpdatedAt: Date, now: Date) {
      return database.$transaction(async (tx) => {
        const request = await tx.contactRequest.findFirst({
          where: { id: requestId, OR: [{ requesterOwnerId: actorOwnerId }, { targetOwnerId: actorOwnerId }] },
          select: { id: true, requesterOwnerId: true, targetOwnerId: true, requesterRepresentationId: true,
            targetRepresentationId: true, status: true, updatedAt: true, contactCreatedAt: true,
            requesterRepresentation: { select: snapshotSelect }, targetRepresentation: { select: snapshotSelect } },
        });
        if (!request) return { outcome: "NOT_FOUND" as const };
        const existing = await tx.representationContact.findMany({ where: { sourceContactRequestId: request.id }, select: contactSelect, orderBy: { id: "asc" } });
        const actorRepresentationId = actorOwnerId === request.requesterOwnerId ? request.requesterRepresentationId : request.targetRepresentationId;
        if (existing.length === 2) return { outcome: "EXISTING" as const, contacts: existing.map(summary), actorContactId: existing.find((row) => row.ownerRepresentation.id === actorRepresentationId)?.id };
        if (request.status !== "ACCEPTED") return { outcome: "NOT_ACCEPTED" as const };
        const existingPair = await tx.representationContact.findMany({ where: { OR: [
          { ownerId: request.requesterOwnerId, ownerRepresentationId: request.requesterRepresentationId, contactRepresentationId: request.targetRepresentationId },
          { ownerId: request.targetOwnerId, ownerRepresentationId: request.targetRepresentationId, contactRepresentationId: request.requesterRepresentationId },
        ] }, select: contactSelect, orderBy: { id: "asc" } });
        if (existingPair.length === 2) {
          if (!request.contactCreatedAt) await tx.contactRequest.updateMany({ where: { id: request.id, status: "ACCEPTED", contactCreatedAt: null }, data: { contactCreatedAt: now } });
          return { outcome: "EXISTING" as const, contacts: existingPair.map(summary), actorContactId: existingPair.find((row) => row.ownerRepresentation.id === actorRepresentationId)?.id };
        }
        if (request.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return { outcome: "CONFLICT" as const };
        const marked = await tx.contactRequest.updateMany({ where: { id: request.id, status: "ACCEPTED", updatedAt: expectedUpdatedAt, contactCreatedAt: null }, data: { contactCreatedAt: now } });
        if (marked.count !== 1) {
          const concurrent = await tx.representationContact.findMany({ where: { sourceContactRequestId: request.id }, select: contactSelect, orderBy: { id: "asc" } });
          return concurrent.length === 2 ? { outcome: "EXISTING" as const, contacts: concurrent.map(summary), actorContactId: concurrent.find((row) => row.ownerRepresentation.id === actorRepresentationId)?.id } : { outcome: "CONFLICT" as const };
        }
        const shared = { sourceContactRequestId: request.id, sourceRequesterRepresentationId: request.requesterRepresentationId, sourceTargetRepresentationId: request.targetRepresentationId, status: "ACTIVE" as const };
        const requesterContact = await tx.representationContact.create({ data: { ...shared, ownerId: request.requesterOwnerId,
          ownerRepresentationId: request.requesterRepresentationId, contactRepresentationId: request.targetRepresentationId,
          ...snapshot(request.targetRepresentation), events: { create: { type: "CREATED", actorUserId: actorOwnerId } } }, select: contactSelect });
        const targetContact = await tx.representationContact.create({ data: { ...shared, ownerId: request.targetOwnerId,
          ownerRepresentationId: request.targetRepresentationId, contactRepresentationId: request.requesterRepresentationId,
          ...snapshot(request.requesterRepresentation), events: { create: { type: "CREATED", actorUserId: actorOwnerId } } }, select: contactSelect });
        return { outcome: "CREATED" as const, contacts: [summary(requesterContact), summary(targetContact)], actorContactId: actorOwnerId === request.requesterOwnerId ? requesterContact.id : targetContact.id };
      });
    },
    findContactsForOwner(ownerId: string, limit = 50) {
      return database.representationContact.findMany({ where: { ownerId }, select: contactSelect,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }, { id: "asc" }], take: Math.min(Math.max(limit, 1), 50) }).then((rows) => rows.map(summary));
    },
    findContactForOwner(ownerId: string, id: string) { return database.representationContact.findFirst({ where: { id, ownerId }, select: contactSelect }).then((row) => row ? summary(row) : null); },
    findExistingPair(ownerRepresentationId: string, contactRepresentationId: string) { return database.representationContact.findMany({ where: { OR: [{ ownerRepresentationId, contactRepresentationId }, { ownerRepresentationId: contactRepresentationId, contactRepresentationId: ownerRepresentationId }] }, select: contactSelect, orderBy: { id: "asc" } }).then((rows) => rows.map(summary)); },
    async archiveContactForOwner(ownerId: string, id: string, expectedUpdatedAt: Date, now: Date) {
      return database.$transaction(async (tx) => { const changed = await tx.representationContact.updateMany({ where: { id, ownerId, status: "ACTIVE", updatedAt: expectedUpdatedAt }, data: { status: "ARCHIVED", archivedAt: now } });
        if (changed.count !== 1) return false; await tx.representationContactEvent.create({ data: { contactId: id, actorUserId: ownerId, type: "ARCHIVED" } }); return true; });
    },
    async restoreContactForOwner(ownerId: string, id: string, expectedUpdatedAt: Date) {
      return database.$transaction(async (tx) => { const changed = await tx.representationContact.updateMany({ where: { id, ownerId, status: "ARCHIVED", updatedAt: expectedUpdatedAt }, data: { status: "ACTIVE", archivedAt: null } });
        if (changed.count !== 1) return false; await tx.representationContactEvent.create({ data: { contactId: id, actorUserId: ownerId, type: "RESTORED" } }); return true; });
    },
  };
}
export const representationContactRepository = createRepresentationContactRepository();
