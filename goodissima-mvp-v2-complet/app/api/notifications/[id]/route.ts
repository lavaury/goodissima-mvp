import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notification-repository";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentPrismaUser();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || body.read !== true) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const notification = await markNotificationRead(params.id, user.id);
  if (!notification) return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  return NextResponse.json(notification);
}
