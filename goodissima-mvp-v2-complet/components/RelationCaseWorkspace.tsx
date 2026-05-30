import { CandidateAccessControls } from "@/components/CandidateAccessControls";
import { AIWorkspace } from "@/components/AIWorkspace";
import { ChatBox } from "@/components/ChatBox";
import { DebugDeleteCaseButton } from "@/components/DebugDeleteCaseButton";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUpload } from "@/components/DocumentUpload";
import { MatchingOptInPanel } from "@/components/MatchingOptInPanel";
import { RelationCaseFields } from "@/components/RelationCaseFields";
import { RelationActionsPanel } from "@/components/RelationActionsPanel";
import {
  getRelationActionStatusLabel,
  getRelationActionTypeLabel,
} from "@/lib/relation-actions";
import { humanizeAIEvent, humanizeRelationEvent } from "@/lib/events/humanize";
import type { Prisma, RelationPriority, RelationStatus } from "@prisma/client";
import Image from "next/image";

type RelationCaseWorkspaceItem = {
  id: string;
  candidateAccessToken: string;
  candidateAccessExpiresAt?: Date | string | null;
  candidateAccessRevokedAt?: Date | string | null;
  candidateName: string;
  candidateEmail?: string;
  matchingEnabled: boolean;
  priority: RelationPriority;
  status: RelationStatus;
  gLink: { title: string; slug?: string | null };
  createdAt: Date | string;
  messages: Array<{
    id: string;
    body: string;
    senderType?: string;
    createdAt: Date | string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    createdAt?: Date | string;
  }>;
  formSubmissions?: Array<{
    id: string;
    answers: Prisma.JsonValue;
    createdAt: Date | string;
    formTemplate: {
      name: string;
      fields: Array<{
        key: string;
        label: string;
        options?: Prisma.JsonValue | null;
        step: number;
        position: number;
        createdAt: Date | string;
      }>;
    };
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
  icon?: string;
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
    case "AI_SUGGESTED_ACTION_ACCEPTED":
      return `Suggestion IA acceptée${getPayloadString(event.payload, "title") ? ` - ${getPayloadString(event.payload, "title")}` : ""}`;
    case "AI_TIMELINE_SUGGESTION_ACCEPTED":
      return `Suggestion timeline IA acceptee${getPayloadString(event.payload, "title") ? ` - ${getPayloadString(event.payload, "title")}` : ""}`;
    case "AI_DRAFT_USED":
      return "Brouillon IA utilise dans l'editeur";
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
    case "AI_SUGGESTED_ACTION_ACCEPTED":
    case "AI_TIMELINE_SUGGESTION_ACCEPTED":
    case "AI_DRAFT_USED":
      return "Demande";
    default:
      return "Evenement";
  }
}

function getHumanizedRelationEventLabel(event: RelationCaseWorkspaceItem["relationEvents"][number]) {
  const humanized = humanizeRelationEvent(
    event.type,
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : null,
  );
  const payloadTitle = getPayloadString(event.payload, "title");
  return payloadTitle ? `${humanized.title} - ${payloadTitle}` : humanized.title;
}

function getHumanizedRelationEventType(eventType: string) {
  return humanizeRelationEvent(eventType).category ?? "Dossier";
}

const technicalAnswerFieldKeys = new Set(["notificationOptIn", "notificationEmail"]);
const technicalAnswerFieldPrefixes = ["notification", "_", "internal"];

function isTechnicalAnswerField(key: string) {
  return technicalAnswerFieldKeys.has(key) || technicalAnswerFieldPrefixes.some((prefix) => key.startsWith(prefix));
}

function getOptionLabel(options: Prisma.JsonValue | null | undefined, value: Prisma.JsonValue) {
  if (typeof value !== "string" || !Array.isArray(options)) return null;

  for (const option of options) {
    if (!option || typeof option !== "object" || Array.isArray(option)) continue;

    const optionValue = option.value;
    const optionLabel = option.label;

    if (optionValue === value && typeof optionLabel === "string") {
      return optionLabel;
    }
  }

  return null;
}

function getSubmissionAnswerEntries(submission: NonNullable<RelationCaseWorkspaceItem["formSubmissions"]>[number]) {
  if (!submission.answers || typeof submission.answers !== "object" || Array.isArray(submission.answers)) {
    return [];
  }

  const answers = submission.answers as Record<string, Prisma.JsonValue>;
  const displayedKeys = new Set<string>();
  const knownEntries = submission.formTemplate.fields
    .filter((field) => !isTechnicalAnswerField(field.key))
    .filter((field) => Object.prototype.hasOwnProperty.call(answers, field.key))
    .map((field) => {
      displayedKeys.add(field.key);
      return {
        key: field.key,
        label: field.label || field.key,
        value: getOptionLabel(field.options, answers[field.key]) ?? answers[field.key],
      };
    });
  const extraEntries = Object.entries(answers)
    .filter(([key]) => !displayedKeys.has(key))
    .filter(([key]) => !isTechnicalAnswerField(key))
    .map(([key, value]) => ({ key, label: key, value }));

  return [...knownEntries, ...extraEntries];
}

function formatSubmissionAnswer(value: Prisma.JsonValue): string {
  if (value === null || value === undefined || value === "") return "Non renseigné";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => formatSubmissionAnswer(item)).join(", ");

  return JSON.stringify(value);
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
      label: getHumanizedRelationEventLabel(event),
      date: event.createdAt,
      type: getHumanizedRelationEventType(event.type),
      icon: humanizeRelationEvent(
        event.type,
        event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : null,
      ).icon,
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
        label: "Document ajoute dans le dossier",
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
  senderType,
  candidateAccessToken,
  debugMode = false,
}: {
  item: RelationCaseWorkspaceItem;
  senderType: "OWNER" | "CANDIDATE";
  candidateAccessToken?: string;
  debugMode?: boolean;
}) {
  const activityEvents = getActivityEvents(item);
  const isCandidateView = senderType === "CANDIDATE";
  const formSubmissions = item.formSubmissions ?? [];

  return (
    <main className="mx-auto max-w-[92rem] bg-[#fbf7f1] px-4 pb-8 pt-6 text-[#2f3437] sm:px-6 sm:py-10">
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#247f88]">Goodissima relation workspace</p>
      <h1 className="mt-2 text-2xl font-bold leading-tight text-[#2f3437] sm:text-3xl">{item.gLink.title}</h1>
      <p className="mt-1 text-sm leading-relaxed text-[#766f68] sm:text-base">
        Dossier avec {item.candidateName}
      </p>
      {debugMode && senderType === "OWNER" ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold uppercase tracking-wide text-amber-800">Debug</p>
          <div className="mt-3 space-y-1">
            {item.gLink.slug ? <p>Lien public candidat: /l/{item.gLink.slug}</p> : null}
            <p>Lien secure: /secure/{item.candidateAccessToken}</p>
          </div>
          <div className="mt-4">
            <DebugDeleteCaseButton caseId={item.id} />
          </div>
        </section>
      ) : null}
      <RelationCaseFields
        caseId={item.id}
        priority={item.priority}
        status={item.status}
        editable={senderType === "OWNER"}
      />
      <div
        data-case-layout="conversation-ai-sidebar"
        className="mt-6 grid gap-5 lg:mt-8 xl:grid-cols-[minmax(420px,1.2fr)_minmax(390px,0.98fr)_280px] xl:gap-5"
      >
        <section data-conversation-zone="true" className="min-w-0 space-y-4">
          <ChatBox
            caseId={candidateAccessToken ? undefined : item.id}
            candidateAccessToken={candidateAccessToken}
            senderType={senderType}
          />
          <div className="rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)] transition hover:shadow-[0_18px_40px_rgba(47,52,55,0.08)]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-[#2f3437]">Documents</h2>
                <p className="text-xs text-[#766f68]">Pieces partagees dans le meme contexte que la conversation.</p>
              </div>
              <span className="rounded-full bg-[#e8f8f9] px-2.5 py-1 text-xs font-medium text-[#247f88]">
                {item.documents.length} document{item.documents.length > 1 ? "s" : ""}
              </span>
            </div>
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
          />
        </section>
        {senderType === "OWNER" ? (
          <AIWorkspace caseId={item.id} matchingEnabled={item.matchingEnabled} />
        ) : null}
        <aside data-metadata-sidebar="true" className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
              Matching
              <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
            </summary>
            <div className="mt-3">
              <MatchingOptInPanel
                caseId={item.id}
                initialMatchingEnabled={item.matchingEnabled}
                candidateAccessToken={candidateAccessToken}
                senderType={senderType}
              />
            </div>
          </details>
          <RelationActionsPanel
            caseId={item.id}
            actions={item.relationActions}
            editable={senderType === "OWNER"}
            candidateAccessToken={candidateAccessToken}
          />
          {senderType === "OWNER" ? (
            <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
                Réponses candidat
                <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
              </summary>
              <div className="mt-3 space-y-3">
                {formSubmissions.length === 0 ? (
                  <p className="rounded-lg bg-[#f6f0e8] px-3 py-2 text-xs text-[#766f68]">
                    Aucune réponse de formulaire enregistrée.
                  </p>
                ) : (
                  formSubmissions.map((submission) => {
                    const entries = getSubmissionAnswerEntries(submission);

                    return (
                      <div key={submission.id} className="rounded-xl bg-[#f6f0e8] p-3 text-xs">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[#2f3437]">{submission.formTemplate.name}</p>
                          <span className="text-[11px] text-[#766f68]">{formatActivityDate(submission.createdAt)}</span>
                        </div>
                        {entries.length === 0 ? (
                          <p className="text-[#766f68]">Aucune réponse exploitable.</p>
                        ) : (
                          <dl className="space-y-2">
                            {entries.map((entry) => (
                              <div key={entry.key} className="border-t border-[#e6ded3] pt-2 first:border-t-0 first:pt-0">
                                <dt className="font-medium text-[#766f68]">{entry.label}</dt>
                                <dd className="mt-0.5 whitespace-pre-wrap break-words text-[#2f3437]">
                                  {formatSubmissionAnswer(entry.value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </details>
          ) : null}
          {senderType === "OWNER" ? (
            <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
                Acces
                <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
              </summary>
              <div className="mt-3">
                <CandidateAccessControls
                  caseId={item.id}
                  candidateAccessToken={item.candidateAccessToken}
                  candidateAccessExpiresAt={item.candidateAccessExpiresAt}
                  candidateAccessRevokedAt={item.candidateAccessRevokedAt}
                />
              </div>
            </details>
          ) : null}
          <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
              Activite recente
              <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
            </summary>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {activityEvents.slice(0, 16).map((event) => (
                <div key={event.id} className="rounded-lg bg-[#f6f0e8] px-2.5 py-2 text-xs transition hover:bg-[#e8f8f9]">
                  <p className="font-medium leading-snug text-[#2f3437]">{event.label}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[#766f68]">
                    <span>{event.type}</span>
                    {"badge" in event && event.badge ? <span>{event.badge}</span> : null}
                    {"status" in event && event.status ? <span>{event.status}</span> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-[#766f68]">{formatRelativeActivityDate(event.date)}</p>
                </div>
              ))}
            </div>
          </details>
          <div className={isCandidateView ? "hidden lg:block" : ""}>
            <details className="group rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#2f3437] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30">
                Audit
                <span className="text-xs font-medium text-[#247f88] transition group-open:rotate-180">v</span>
              </summary>
              <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-2 lg:max-h-80">
                {item.auditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl bg-[#f6f0e8] p-2 text-xs">
                    <p className="font-medium text-[#2f3437]">{humanizeAIEvent(log.eventType).title}</p>
                    <p className="text-[#766f68]">
                      {formatActivityDate(log.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </aside>
      </div>
    </main>
  );
}
