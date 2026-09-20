import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type NotificationClient = Pick<Prisma.TransactionClient, "notification">;

export type CreateNotificationInput = {
  recipientUserId: string;
  type: NotificationType;
  relationCaseId: string;
  sourceEventId?: string | null;
  idempotencyKey: string;
};

function clientOrDefault(client?: NotificationClient) {
  return client ?? prisma;
}

export function relationCaseNotificationKey(relationCaseId: string, recipientUserId: string) {
  return `CASE_CREATED:${relationCaseId}:${recipientUserId}`;
}

export function messageNotificationKey(messageId: string, recipientUserId: string) {
  return `MESSAGE_SENT:${messageId}:${recipientUserId}`;
}

export async function createNotification(input: CreateNotificationInput, client?: NotificationClient) {
  return clientOrDefault(client).notification.create({ data: input });
}

export async function createNotificationOnce(input: CreateNotificationInput, client?: NotificationClient) {
  const db = clientOrDefault(client);
  const inserted = await db.notification.createMany({ data: [input], skipDuplicates: true });
  const notification = await db.notification.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
  return { notification, created: inserted.count === 1 };
}

export async function listNotificationsForUser(userId: string, options: { limit?: number; page?: number; unreadOnly?: boolean } = {}, client?: NotificationClient) {
  const requestedLimit = Number.isInteger(options.limit) ? Number(options.limit) : DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const requestedPage = Number.isInteger(options.page) ? Number(options.page) : 0;
  const page = Math.min(Math.max(requestedPage, 0), 1000);
  return clientOrDefault(client).notification.findMany({
    where: { recipientUserId: userId, ...(options.unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    skip: page * limit,
    select: { id: true, type: true, relationCaseId: true, createdAt: true, readAt: true },
  });
}

export async function countUnreadNotificationsForUser(userId: string, client?: NotificationClient) {
  return clientOrDefault(client).notification.count({ where: { recipientUserId: userId, readAt: null } });
}

export async function markNotificationRead(notificationId: string, userId: string, client?: NotificationClient) {
  const db = clientOrDefault(client);
  await db.notification.updateMany({
    where: { id: notificationId, recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return db.notification.findFirst({
    where: { id: notificationId, recipientUserId: userId },
    select: { id: true, type: true, relationCaseId: true, createdAt: true, readAt: true },
  });
}
