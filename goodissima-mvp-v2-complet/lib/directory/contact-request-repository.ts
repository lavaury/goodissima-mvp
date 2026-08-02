import type { ContactRequestStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ContactRequestChannel, ContactRequestSummary, CreateContactRequestInput } from "@/lib/directory/contact-request-contracts";

type Db = PrismaClient;
const representation = { id: true, displayName: true, title: true, organizationName: true } satisfies Prisma.RepresentationSelect;
const requestInclude = {
  requesterRepresentation: { select: representation }, targetRepresentation: { select: representation },
  requestedChannels: { select: { channel: true }, orderBy: { channel: "asc" as const } },
} satisfies Prisma.ContactRequestInclude;
const persistedRequestInclude = {
  ...requestInclude,
  events: { where: { type: "CREATED" as const }, select: { id: true, type: true } },
} satisfies Prisma.ContactRequestInclude;
const statusOrder: Record<string, number> = { PENDING: 0, DEFERRED: 1, ACCEPTED: 2, REFUSED: 2, CANCELLED: 2, EXPIRED: 2 };

function summary(row: Prisma.ContactRequestGetPayload<{ include: typeof requestInclude }>, direction: "incoming" | "outgoing"): ContactRequestSummary {
  return { id: row.id, direction, source: row.requesterRepresentation, target: row.targetRepresentation, reason: row.reason,
    channels: row.requestedChannels.map((item) => item.channel as ContactRequestChannel), contextType: row.contextType, contextId: row.contextId,
    status: row.status, expiresAt: row.expiresAt, deferredUntil: row.deferredUntil, decidedAt: row.decidedAt,
    cancelledAt: row.cancelledAt, contactCreatedAt: row.contactCreatedAt, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export type ContactRequestRepository = ReturnType<typeof createContactRequestRepository>;
export function createContactRequestRepository(database: Db = prisma) {
  async function expireForOwner(ownerId: string, direction: "incoming" | "outgoing", now: Date) {
    const ownerField = direction === "incoming" ? { targetOwnerId: ownerId } : { requesterOwnerId: ownerId };
    const expired = await database.contactRequest.findMany({ where: { ...ownerField, status: { in: ["PENDING", "DEFERRED"] }, expiresAt: { lte: now } }, select: { id: true } });
    if (!expired.length) return;
    await database.$transaction(async (tx) => {
      for (const { id } of expired) {
        const changed = await tx.contactRequest.updateMany({ where: { id, status: { in: ["PENDING", "DEFERRED"] }, expiresAt: { lte: now } }, data: { status: "EXPIRED", decidedAt: now, deferredUntil: null } });
        if (changed.count === 1) await tx.contactRequestEvent.create({ data: { requestId: id, type: "EXPIRED" } });
      }
    });
  }
  return {
    async createRequest(ownerId: string, input: CreateContactRequestInput, expiresAt: Date) {
      return database.$transaction(async (tx) => {
        const source = await tx.representation.findFirst({ where: { id: input.requesterRepresentationId, ownerId, status: "ACTIVE" }, select: { id: true, ownerId: true } });
        const target = await tx.representation.findFirst({ where: { id: input.targetRepresentationId, status: "ACTIVE", visibility: "DISCOVERABLE", publishedAt: { not: null } }, select: { id: true, ownerId: true, relationshipPolicy: true } });
        if (!source || !target) return { outcome: "NOT_FOUND" as const };
        if (source.id === target.id) return { outcome: "SELF_REPRESENTATION" as const };
        if (source.ownerId === target.ownerId) return { outcome: "SAME_OWNER" as const };
        if (target.relationshipPolicy === "CLOSED") return { outcome: "POLICY_CLOSED" as const };
        if (target.relationshipPolicy === "MESSAGE_ONLY" && (input.channels.length !== 1 || input.channels[0] !== "MESSAGE")) return { outcome: "POLICY_MESSAGE_ONLY" as const };
        const candidates = await tx.contactRequest.findMany({ where: { requesterRepresentationId: source.id, targetRepresentationId: target.id, status: "PENDING" }, include: { requestedChannels: { select: { channel: true } } }, take: 10 });
        const canonical = [...input.channels].sort().join(",");
        if (candidates.some((item) => item.requestedChannels.map(({ channel }) => channel).sort().join(",") === canonical)) return { outcome: "DUPLICATE" as const };
        const created = await tx.contactRequest.create({ data: { requesterOwnerId: ownerId, requesterRepresentationId: source.id, targetOwnerId: target.ownerId, targetRepresentationId: target.id,
          reason: input.reason, contextType: input.contextType ?? null, contextId: input.contextId ?? null, status: "PENDING", expiresAt,
          requestedChannels: { create: input.channels.map((channel) => ({ channel })) }, events: { create: { type: "CREATED", actorUserId: ownerId } } }, include: requestInclude });
        const persisted = await tx.contactRequest.findUnique({ where: { id: created.id }, include: persistedRequestInclude });
        if (!persisted || persisted.status !== "PENDING" || persisted.requestedChannels.length !== input.channels.length || persisted.events.length !== 1) {
          throw new Error("CONTACT_REQUEST_PERSISTENCE_CONFIRMATION_FAILED");
        }
        return { outcome: "CREATED" as const, request: summary(persisted, "outgoing") };
      });
    },
    async findIncomingForOwner(ownerId: string, limit = 50) {
      await expireForOwner(ownerId, "incoming", new Date());
      const rows = await database.contactRequest.findMany({ where: { targetOwnerId: ownerId }, include: requestInclude, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: Math.min(Math.max(limit, 1), 50) });
      if (rows.length) {
        const alreadyViewed = await database.contactRequestEvent.findMany({ where: { requestId: { in: rows.map(({ id }) => id) }, type: "VIEWED_BY_TARGET" }, select: { requestId: true } });
        const viewedIds = new Set(alreadyViewed.map(({ requestId }) => requestId));
        const firstViews = rows.filter(({ id }) => !viewedIds.has(id));
        if (firstViews.length) await database.contactRequestEvent.createMany({ data: firstViews.map(({ id: requestId }) => ({ requestId, actorUserId: ownerId, type: "VIEWED_BY_TARGET" })), skipDuplicates: true });
      }
      return rows.map((row) => summary(row, "incoming")).sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
    },
    async findOutgoingForOwner(ownerId: string, limit = 50) {
      await expireForOwner(ownerId, "outgoing", new Date());
      const rows = await database.contactRequest.findMany({ where: { requesterOwnerId: ownerId }, include: requestInclude, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: Math.min(Math.max(limit, 1), 50) });
      return rows.map((row) => summary(row, "outgoing")).sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
    },
    findForDecision(ownerId: string, id: string) { return database.contactRequest.findFirst({ where: { id, targetOwnerId: ownerId }, include: requestInclude }); },
    findForCancellation(ownerId: string, id: string) { return database.contactRequest.findFirst({ where: { id, requesterOwnerId: ownerId }, include: requestInclude }); },
    async decideConditionally(ownerId: string, id: string, expectedUpdatedAt: Date, from: ContactRequestStatus[], data: Prisma.ContactRequestUncheckedUpdateManyInput, event: "ACCEPTED" | "REFUSED" | "DEFERRED" | "RESUMED") {
      return database.$transaction(async (tx) => { const changed = await tx.contactRequest.updateMany({ where: { id, targetOwnerId: ownerId, status: { in: from }, updatedAt: expectedUpdatedAt }, data });
        if (changed.count !== 1) return false; await tx.contactRequestEvent.create({ data: { requestId: id, actorUserId: ownerId, type: event } }); return true; });
    },
    async cancelConditionally(ownerId: string, id: string, expectedUpdatedAt: Date, now: Date) {
      return database.$transaction(async (tx) => { const changed = await tx.contactRequest.updateMany({ where: { id, requesterOwnerId: ownerId, status: { in: ["PENDING", "DEFERRED"] }, updatedAt: expectedUpdatedAt }, data: { status: "CANCELLED", cancelledAt: now, decidedAt: now, deferredUntil: null } });
        if (changed.count !== 1) return false; await tx.contactRequestEvent.create({ data: { requestId: id, actorUserId: ownerId, type: "CANCELLED" } }); return true; });
    },
    async markExpiredIfNeeded(id: string, now: Date) { return database.$transaction(async (tx) => { const changed = await tx.contactRequest.updateMany({ where: { id, status: { in: ["PENDING", "DEFERRED"] }, expiresAt: { lte: now } }, data: { status: "EXPIRED", decidedAt: now, deferredUntil: null } }); if (changed.count === 1) await tx.contactRequestEvent.create({ data: { requestId: id, type: "EXPIRED" } }); return changed.count === 1; }); },
  };
}
export const contactRequestRepository = createContactRequestRepository();
