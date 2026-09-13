import type { FactualAlert } from "@/lib/factual-attention";
import type { NotificationView } from "@/lib/notification-projection";
import type { UnifiedAttentionItem } from "@/components/FactualAttentionList";

export function notificationAttention(item: NotificationView): UnifiedAttentionItem {
  return { key: `notification:${item.id}`, relationCaseId: item.relationCaseId, notificationId: item.id, title: item.title, contextLabel: item.contextLabel, reason: item.description, href: item.href, createdAt: item.createdAt };
}

export function factualAttention(item: FactualAlert): UnifiedAttentionItem {
  return { key: `factual:${item.id}`, relationCaseId: item.id, title: item.object, contextLabel: item.label, reason: item.reason, href: item.href };
}

/** Unread notifications lead; legacy facts fill the remaining space without repeating a Dossier. */
export function mergeAttention(notifications: NotificationView[], factual: FactualAlert[], limit = 3) {
  const result = notifications.map(notificationAttention);
  const representedCases = new Set(result.map(item => item.relationCaseId));
  for (const item of factual) if (result.length < limit && !representedCases.has(item.id)) {
    result.push(factualAttention(item)); representedCases.add(item.id);
  }
  return result.slice(0, limit);
}
