import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { countUnreadNotificationsForUser, listNotificationsForUser } from "@/lib/notification-repository";

export async function GET(request: Request) {
  const user = await getCurrentPrismaUser();
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isInteger(requestedLimit) ? requestedLimit : 20;
  const requestedPage = Number(url.searchParams.get("page") ?? 0);
  const page = Number.isInteger(requestedPage) ? requestedPage : 0;
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const [notifications, unreadCount] = await Promise.all([
    listNotificationsForUser(user.id, { limit, page, unreadOnly }),
    countUnreadNotificationsForUser(user.id),
  ]);
  return NextResponse.json({ notifications, unreadCount });
}
