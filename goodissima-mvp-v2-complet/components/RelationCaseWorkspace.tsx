import { CandidateAccessControls } from "@/components/CandidateAccessControls";
import { ChatBox } from "@/components/ChatBox";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUpload } from "@/components/DocumentUpload";
import { RelationCaseFields } from "@/components/RelationCaseFields";
import { RelationActionsPanel } from "@/components/RelationActionsPanel";
import {
  getRelationActionStatusLabel,
  getRelationActionTypeLabel,
} from "@/lib/relation-actions";
import type { Prisma, RelationPriority, RelationStatus } from "@prisma/client";
import Image from "next/image";

type RelationCaseWorkspaceItem = {
  id: string;
  candidateAccessToken: string;
  candidateAccessExpiresAt?: Date | string | null;
  candidateAccessRevokedAt?: Date | string | null;
  candidateName: string;
  candidateEmail: string;
  priority: RelationPriority;
  status: RelationStatus;
  gLink: { title: string };
  createdAt: Date | string;
  messages: Array<{
    id: string;
    body: string;
    senderType?: string;
    senderEmail: string;
    createdAt: Date | string;
  }>;
  documents: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    uploadedByEmail?: string;
    createdAt?: Date | string;
  }>;
  relationActions: Array<{
    id: string;
    type: string;
    status: string;
    title: string;
    description?: string | null;
    payload?: Prisma.JsonValue | null;
    createdByRole: string;
    completedAt?: Date | string | null;
    createdAt: Date | string;
  }>;
  auditLogs: Array<{ id: string; eventType: string; createdAt: Date | string }>;
  relationEvents: Array<{
    id: string;
    type: string;
    actorType?: string | null;
    payload?: Prisma.JsonValue | null;
    createdAt: Date | string;
  }>;
};

type ActivityEvent = {
  id: string;
  label: string;
  date: Date | string;
  type: string;
  badge?: string;
  status?: string;
  actor?: string;
};

const parisDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatActivityDate(date: Date | string) {
  return parisDateFormatter.format(new Date(date));
}

function formatRelativeActivityDate(date: Date | string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  if (diffHours >= 1) return `Il y a ${diffHours}h`;
  return `Il y a ${diffMinutes} min`;
}

function getPayloadString(payload: Prisma.JsonValue | null | undefined, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function getRelationEventLabel(event: RelationCaseWorkspaceItem["relationEvents"][number]) {
  switch (event.type) {
    case "MESSAGE_SENT":
      return event.actorType === "OWNER"
        ? "Message envoye par proprietaire"
        : "Message envoye par candidat";
    case "DOCUMENT_UPLOADED":
      return event.actorType === "OWNER"
        ? "Document ajoute par proprietaire"
        : "Document ajoute par candidat";
    case "STATUS_CHANGED":
      return "Statut modifie";
    case "PRIORITY_CHANGED":
      return "Priorite modifiee";
    case "CASE_ARCHIVED":
      return "Dossier archive";
    case "CASE_RESTORED":
      return "Dossier reactive";
    case "ACTION_CREATED":
      return `Demande créée${getPayloadString(event.payload, "title") ? ` - ${getPayloadString(event.payload, "title")}` : ""}`;
    case "ACTION_COMPLETED":
      return `Demande complétée${getPayloadString(event.payload, "title") ? ` - ${getPayloadString(event.payload, "title")}` : ""}`;
    default:
      return event.type;
  }
}

function getRelationEventType(eventType: string) {
  switch (eventType) {
    case "MESSAGE_SENT":
      return "Message";
    case "DOCUMENT_UPLOADED":
      return "Document";
    case "STATUS_CHANGED":
    case "PRIORITY_CHANGED":
    case "CASE_ARCHIVED":
    case "CASE_RESTORED":
      return "Dossier";
    case "ACTION_CREATED":
    case "ACTION_COMPLETED":
      return "Demande";
    default:
      return "Evenement";
  }
}

function getActivityEvents(item: RelationCaseWorkspaceItem): ActivityEvent[] {
  const eventMessageIds = new Set(
    item.relationEvents
      .map((event) => getPayloadString(event.payload, "messageId"))
      .filter(Boolean),
  );
  const eventDocumentIds = new Set(
    item.relationEvents
      .map((event) => getPayloadString(event.payload, "documentId"))
      .filter(Boolean),
  );

  const events = [
    {
      id: `case-${item.id}`,
      label: "Dossier créé",
      date: item.createdAt,
      type: "Dossier",
    },
    ...item.relationEvents.map((event) => ({
      id: `relation-event-${event.id}`,
      label: getRelationEventLabel(event),
      date: event.createdAt,
      type: getRelationEventType(event.type),
    })),
    ...item.messages
      .filter((message) => !eventMessageIds.has(message.id))
      .map((message) => ({
        id: `message-${message.id}`,
        label:
          message.senderType === "OWNER"
            ? "Message envoye par proprietaire"
            : "Message envoye par candidat",
        date: message.createdAt,
        type: "Message",
      })),
    ...item.documents
      .filter((document) => document.createdAt)
      .filter((document) => !eventDocumentIds.has(document.id))
      .map((document) => ({
        id: `document-${document.id}`,
        label:
          document.uploadedByEmail === item.candidateEmail
            ? "Document ajoute par candidat"
            : "Document ajoute par proprietaire",
        date: document.createdAt!,
        type: "Document",
      })),
    ...item.relationActions.map((action) => ({
      id: `action-${action.id}`,
      label: action.title,
      date: action.completedAt ?? action.createdAt,
      type: "Demande",
      badge: getRelationActionTypeLabel(action.type),
      status: getRelationActionStatusLabel(action.status),
      actor: action.createdByRole,
    })),
  ];

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function RelationCaseWorkspace({
  item,
  senderEmail,
  senderType,
  candidateAccessToken,
}: {
  item: RelationCaseWorkspaceItem;
  senderEmail: string;
  senderType: "OWNER" | "CANDIDATE";
  candidateAccessToken?: string;
}) {
  const activityEvents = getActivityEvents(item);
  const isCandidateView = senderType === "CANDIDATE";

  return (
    <main className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:py-10">
      {isCandidateView ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Image
            src="/logo-goodissima.png"
            alt="Goodissima"
            width={240}
            height={104}
            priority
            className="h-auto w-44 sm:w-60"
          />
          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-700">
            <span className="rounded-full bg-emerald-50 px-3 py-1 ring-1 ring-emerald-200">Conversation sécurisée</span>
            <span className="rounded-full bg-sky-50 px-3 py-1 ring-1 ring-sky-200">Documents proteges</span>
          </div>
        </div>
      ) : null}
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{item.gLink.title}</h1>
      <p className="mt-1 text-sm leading-relaxed text-slate-500 sm:text-base">
        Dossier avec {item.candidateName} - {item.candidateEmail}
      </p>
      <RelationCaseFields
        caseId={item.id}
        priority={item.priority}
        status={item.status}
        editable={senderType === "OWNER"}
      />
      <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4">
        <h2 className="font-semibold">Activité du dossier</h2>
        <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto pr-2 sm:max-h-[28rem] lg:max-h-[calc(100vh-22rem)]">
          {activityEvents.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              L'activité du dossier apparaîtra ici au fil des messages, documents et demandes.
            </div>
          ) : null}
          {activityEvents.map((event) => (
            <div
              key={event.id}
              className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div>
                <p className="font-medium text-slate-800">{event.label}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{event.type}</span>
                  {"badge" in event && event.badge ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">
                      {event.badge}
                    </span>
                  ) : null}
                  {"status" in event && event.status ? <span>{event.status}</span> : null}
                  {"actor" in event && event.actor ? <span>Acteur: {event.actor}</span> : null}
                </div>
              </div>
              <p className="shrink-0 text-xs text-slate-500">
                {formatRelativeActivityDate(event.date)}
                <span className="block text-[11px]">{formatActivityDate(event.date)}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-[1fr_360px] lg:gap-6">
        <ChatBox
          caseId={candidateAccessToken ? undefined : item.id}
          candidateAccessToken={candidateAccessToken}
          senderEmail={senderEmail}
          senderType={senderType}
        />
        <aside className="space-y-4">
          <RelationActionsPanel
            caseId={item.id}
            actions={item.relationActions}
            editable={senderType === "OWNER"}
            candidateAccessToken={candidateAccessToken}
          />
          <div className="rounded-2xl border bg-white p-4 sm:p-5 lg:p-4">
            <h2 className="font-semibold">Documents</h2>
            <div className="mt-3">
              <DocumentList
                documents={item.documents}
                caseId={candidateAccessToken ? undefined : item.id}
                candidateAccessToken={candidateAccessToken}
              />
            </div>
          </div>
          <DocumentUpload
            caseId={candidateAccessToken ? undefined : item.id}
            candidateAccessToken={candidateAccessToken}
            uploadedByEmail={senderEmail}
          />
          {senderType === "OWNER" ? (
            <CandidateAccessControls
              caseId={item.id}
              candidateAccessToken={item.candidateAccessToken}
              candidateAccessExpiresAt={item.candidateAccessExpiresAt}
              candidateAccessRevokedAt={item.candidateAccessRevokedAt}
            />
          ) : null}
          <div className={isCandidateView ? "hidden lg:block" : ""}>
            <div className="rounded-2xl border bg-white p-4">
              <h2 className="font-semibold">Historique minimal</h2>
              <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-2 lg:max-h-80">
                {item.auditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl bg-slate-50 p-2 text-xs">
                    <p className="font-medium">{log.eventType}</p>
                    <p className="text-slate-500">
                      {formatActivityDate(log.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
