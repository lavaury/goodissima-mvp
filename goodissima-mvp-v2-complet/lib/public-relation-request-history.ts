export const relationRequestNotificationAuditTypes = [
  "RELATION_REQUEST_DECISION_NOTIFICATION_SENT",
  "RELATION_REQUEST_DECISION_NOTIFICATION_SKIPPED",
  "RELATION_REQUEST_DECISION_NOTIFICATION_FAILED",
] as const;

type NotificationAuditType = typeof relationRequestNotificationAuditTypes[number];

export type PublicRelationRequestHistoryEvent = {
  type: "REQUEST_CREATED" | "REQUEST_ACCEPTED" | "REQUEST_DECLINED" | "CASE_CREATED" | "REQUESTER_NOTIFICATION_SENT" | "REQUESTER_NOTIFICATION_SKIPPED" | "REQUESTER_NOTIFICATION_FAILED";
  occurredAt: string;
  label: string;
  detail?: string;
  actorLabel?: string;
};

type RequestHistorySource = {
  id: string;
  status: string;
  createdAt: Date | string;
  decidedAt?: Date | string | null;
  decidedByUserId?: string | null;
  declineReason?: string | null;
  relationCaseId?: string | null;
  decidedByUser?: { name?: string | null } | null;
  relationCase?: { id: string; createdAt: Date | string } | null;
};

type RequestHistoryAudit = {
  eventType: string;
  createdAt: Date | string;
  metadata?: unknown;
};

function iso(value: Date | string) {
  return new Date(value).toISOString();
}

function auditRequestId(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof (metadata as Record<string, unknown>).requestId === "string"
    ? (metadata as Record<string, unknown>).requestId as string
    : null;
}

export function projectPublicRelationRequestHistory(request: RequestHistorySource, audits: RequestHistoryAudit[] = []): PublicRelationRequestHistoryEvent[] {
  const events: PublicRelationRequestHistoryEvent[] = [{ type: "REQUEST_CREATED", occurredAt: iso(request.createdAt), label: "Demande envoyée" }];
  const candidateActorName = request.decidedByUserId ? request.decidedByUser?.name?.trim() ?? "" : "";
  const actorName = candidateActorName && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateActorName) ? candidateActorName : "";
  const actorLabel = actorName ? `Décision prise par ${actorName}` : undefined;

  if (request.status === "ACCEPTED" && request.decidedAt) {
    events.push({ type: "REQUEST_ACCEPTED", occurredAt: iso(request.decidedAt), label: "Demande acceptée", ...(actorLabel ? { actorLabel } : {}) });
    if (request.relationCaseId && request.relationCase?.id === request.relationCaseId) {
      events.push({ type: "CASE_CREATED", occurredAt: iso(request.relationCase.createdAt), label: "Dossier créé" });
    }
  } else if (request.status === "DECLINED" && request.decidedAt) {
    events.push({ type: "REQUEST_DECLINED", occurredAt: iso(request.decidedAt), label: "Demande refusée", ...(request.declineReason ? { detail: request.declineReason } : {}), ...(actorLabel ? { actorLabel } : {}) });
  }

  const notificationEvents: Record<NotificationAuditType, Pick<PublicRelationRequestHistoryEvent, "type" | "label">> = {
    RELATION_REQUEST_DECISION_NOTIFICATION_SENT: { type: "REQUESTER_NOTIFICATION_SENT", label: "Demandeur prévenu par e-mail" },
    RELATION_REQUEST_DECISION_NOTIFICATION_SKIPPED: { type: "REQUESTER_NOTIFICATION_SKIPPED", label: "Aucune notification e-mail demandée" },
    RELATION_REQUEST_DECISION_NOTIFICATION_FAILED: { type: "REQUESTER_NOTIFICATION_FAILED", label: "La notification e-mail n'a pas pu être délivrée" },
  };
  for (const audit of request.status === "PENDING" ? [] : audits) {
    if (auditRequestId(audit.metadata) !== request.id || !relationRequestNotificationAuditTypes.includes(audit.eventType as NotificationAuditType)) continue;
    const projected = notificationEvents[audit.eventType as NotificationAuditType];
    events.push({ ...projected, occurredAt: iso(audit.createdAt) });
  }

  return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}
