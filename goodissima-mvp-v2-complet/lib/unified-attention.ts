import type { FactualAlert } from "@/lib/factual-attention";
import type { NotificationView } from "@/lib/notification-projection";
import type { UnifiedAttentionItem } from "@/components/FactualAttentionList";
import type { PendingRelationRequestAttention } from "@/lib/pending-relation-request-attention";

export function notificationAttention(item: NotificationView): UnifiedAttentionItem {
  return { kind: "PERSISTED_NOTIFICATION", key: `notification:${item.id}`, relationCaseId: item.relationCaseId, notificationId: item.id, title: item.title, contextLabel: item.contextLabel, reason: item.description, href: item.href, createdAt: item.createdAt };
}

export function relationRequestAttention(item: PendingRelationRequestAttention): UnifiedAttentionItem {
  return { kind: "RELATION_REQUEST_ATTENTION", key: `relation-request:${item.requestId}`, requestId: item.requestId, title: "Demande de relation", contextLabel: item.title, reason: item.candidateName ? `${item.candidateName} souhaite entrer en relation. Cette demande attend votre décision.` : "Une personne souhaite entrer en relation. Cette demande attend votre décision.", href: item.href, createdAt: item.createdAt };
}

export function factualAttention(item: FactualAlert): UnifiedAttentionItem {
  return { kind: "FACTUAL_ATTENTION", key: `factual:${item.id}`, relationCaseId: item.id, title: item.object, contextLabel: item.label, reason: item.reason, href: item.href };
}

/** Unread notifications lead; legacy facts fill the remaining space without repeating a Dossier. */
export function mergeAttention(notifications: NotificationView[], factual: FactualAlert[], limit = 3, relationRequests: PendingRelationRequestAttention[] = []) {
  const result = [...relationRequests.map(relationRequestAttention), ...notifications.map(notificationAttention)].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  const representedCases = new Set(result.flatMap(item => item.relationCaseId ? [item.relationCaseId] : []));
  for (const item of factual) if (result.length < limit && !representedCases.has(item.id)) {
    result.push(factualAttention(item)); representedCases.add(item.id);
  }
  return result.slice(0, limit);
}
