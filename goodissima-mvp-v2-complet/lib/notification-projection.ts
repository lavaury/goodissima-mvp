import { prisma } from "@/lib/prisma";
import { resolveCandidateIdentityState } from "@/lib/candidate-identity";

const MAX_UI_LIMIT = 20;

export type NotificationView = {
  kind: "PERSISTED_NOTIFICATION";
  id: string;
  type: "NEW_RELATION_CASE" | "NEW_MESSAGE";
  relationCaseId: string;
  title: string;
  description: string;
  contextLabel: string;
  href: string;
  createdAt: Date;
  readAt: Date | null;
};

export async function getNotificationViewsForUser(userId: string, options: { limit?: number; page?: number; unreadOnly?: boolean } = {}) {
  const limit = Math.min(Math.max(Number.isInteger(options.limit) ? Number(options.limit) : 10, 1), MAX_UI_LIMIT);
  const page = Math.min(Math.max(Number.isInteger(options.page) ? Number(options.page) : 0, 0), 1000);
  const rows = await prisma.notification.findMany({
    where: { recipientUserId: userId, relationCase: { ownerId: userId }, ...(options.unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    skip: page * limit,
    select: {
      id: true, type: true, relationCaseId: true, createdAt: true, readAt: true,
      relationCase: { select: { gLink: { select: { title: true } } } },
    },
  });
  return {
    hasMore: rows.length > limit,
    items: rows.slice(0, limit).map(({ relationCase, ...row }): NotificationView => ({
      kind: "PERSISTED_NOTIFICATION",
      ...row,
      title: row.type === "NEW_RELATION_CASE" ? "Nouvel échange" : "Nouveau message",
      description: row.type === "NEW_RELATION_CASE" ? "Une personne a commencé un échange." : "Un nouveau message a été reçu.",
      contextLabel: relationCase.gLink.title,
      href: `/cases/${encodeURIComponent(row.relationCaseId)}`,
    })),
  };
}

export type UnreadCaseAttention = {
  relationCaseId: string;
  workspaceId: string | null;
  caseLabel: string;
  count: number;
  newestNotificationId: string;
  newestType: "NEW_RELATION_CASE" | "NEW_MESSAGE";
};

/** Server-only aggregation for Mes espaces. One bounded query, never exposed by the notification API. */
export async function getUnreadCaseAttentionForUser(userId: string): Promise<UnreadCaseAttention[]> {
  const rows = await prisma.notification.findMany({
    where: { recipientUserId: userId, readAt: null, relationCase: { ownerId: userId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
    select: {
      id: true, type: true, relationCaseId: true,
      relationCase: { select: { workspaceId: true, candidateName: true, candidateEmail: true } },
    },
  });
  const grouped = new Map<string, UnreadCaseAttention>();
  for (const row of rows) {
    const current = grouped.get(row.relationCaseId);
    if (current) current.count++;
    else grouped.set(row.relationCaseId, {
      relationCaseId: row.relationCaseId,
      workspaceId: row.relationCase.workspaceId,
      caseLabel: resolveCandidateIdentityState(row.relationCase).displayName,
      count: 1,
      newestNotificationId: row.id,
      newestType: row.type,
    });
  }
  return [...grouped.values()];
}
