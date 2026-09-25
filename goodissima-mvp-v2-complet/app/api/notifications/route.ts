import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { countUnreadNotificationsForUser } from "@/lib/notification-repository";
import { getNotificationViewsForUser } from "@/lib/notification-projection";
import { getPendingRelationRequestAttentionForUser } from "@/lib/pending-relation-request-attention";

export async function GET(request: Request) {
  const user = await getCurrentPrismaUser();
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isInteger(requestedLimit) ? requestedLimit : 20;
  const requestedPage = Number(url.searchParams.get("page") ?? 0);
  const page = Number.isInteger(requestedPage) ? requestedPage : 0;
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const [projection, persistedUnreadCount, relationRequests] = await Promise.all([
    getNotificationViewsForUser(user.id, { limit, page, unreadOnly }),
    countUnreadNotificationsForUser(user.id),
    getPendingRelationRequestAttentionForUser(user.id),
  ]);
  const notifications = page === 0 ? [...relationRequests, ...projection.items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit) : projection.items;
  return NextResponse.json({ notifications, hasMore: projection.hasMore, unreadCount: persistedUnreadCount + relationRequests.length });
}
