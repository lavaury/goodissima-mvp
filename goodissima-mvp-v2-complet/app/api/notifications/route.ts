import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { countUnreadNotificationsForUser } from "@/lib/notification-repository";
import { getNotificationViewsForUser } from "@/lib/notification-projection";

export async function GET(request: Request) {
  const user = await getCurrentPrismaUser();
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isInteger(requestedLimit) ? requestedLimit : 20;
  const requestedPage = Number(url.searchParams.get("page") ?? 0);
  const page = Number.isInteger(requestedPage) ? requestedPage : 0;
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const [projection, unreadCount] = await Promise.all([
    getNotificationViewsForUser(user.id, { limit, page, unreadOnly }),
    countUnreadNotificationsForUser(user.id),
  ]);
  return NextResponse.json({ notifications: projection.items, hasMore: projection.hasMore, unreadCount });
}
