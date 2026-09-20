import { prisma } from "@/lib/prisma";
import { sendNewMessageEmail, sendNewRelationCaseEmail } from "@/lib/email";
import { defaultNotificationPreferences, isNotificationEnabled } from "@/lib/privacy";

export const NEW_MESSAGE_EMAIL_COOLDOWN_MS = 30 * 60 * 1000;
export type NotificationEmailResult = { status: "sent" | "skipped" | "failed"; reason?: string };

function skipped(notification: { id: string; type: string; relationCaseId: string }, reason: string): NotificationEmailResult {
  console.info("[notification-email] Delivery skipped", { notificationId: notification.id, type: notification.type, relationCaseId: notification.relationCaseId, status: "skipped", reason });
  return { status: "skipped", reason };
}

function safeContextLabel(value: string | null | undefined) {
  const label = value?.trim();
  return label && !/private-.*@goodissima\.local/i.test(label) ? label : "un de vos échanges";
}

/** V1 channel adapter. Notification creation remains authoritative; provider delivery is best effort. */
export async function maybeSendNotificationEmail(notificationId: string): Promise<NotificationEmailResult> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: {
      id: true, type: true, recipientUserId: true, relationCaseId: true, createdAt: true,
      recipient: { select: { email: true, notificationPreferences: true } },
      relationCase: { select: { ownerId: true, gLink: { select: { title: true } } } },
    },
  });
  if (!notification) return { status: "skipped", reason: "notification_not_found" };
  if (notification.relationCase.ownerId !== notification.recipientUserId) return skipped(notification, "invalid_scope");

  const preferences = notification.recipient.notificationPreferences ?? defaultNotificationPreferences;
  const kind = notification.type === "NEW_RELATION_CASE" ? "requests" : "messages";
  if (!isNotificationEnabled(preferences, kind)) return skipped(notification, `${kind}_disabled`);
  if (preferences.frequency !== "IMMEDIATE") return skipped(notification, "frequency_not_immediate");

  if (notification.type === "NEW_MESSAGE") {
    const previous = await prisma.notification.findFirst({
      where: {
        id: { not: notification.id }, recipientUserId: notification.recipientUserId,
        relationCaseId: notification.relationCaseId, type: "NEW_MESSAGE",
        createdAt: { gte: new Date(notification.createdAt.getTime() - NEW_MESSAGE_EMAIL_COOLDOWN_MS), lt: notification.createdAt },
      },
      select: { id: true },
    });
    if (previous) return skipped(notification, "cooldown");
  }

  const input = { ownerEmail: notification.recipient.email, caseId: notification.relationCaseId, caseTitle: safeContextLabel(notification.relationCase.gLink.title) };
  try {
    const result = notification.type === "NEW_RELATION_CASE" ? await sendNewRelationCaseEmail(input) : await sendNewMessageEmail(input);
    const status = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
    console.info("[notification-email] Delivery result", { notificationId: notification.id, type: notification.type, relationCaseId: notification.relationCaseId, status });
    return { status, ...(!result.ok ? { reason: result.skipped ? "provider_unavailable" : "provider_failure" } : {}) };
  } catch {
    console.error("[notification-email] Provider failure", { notificationId: notification.id, type: notification.type, relationCaseId: notification.relationCaseId, status: "failed" });
    return { status: "failed", reason: "provider_failure" };
  }
}
