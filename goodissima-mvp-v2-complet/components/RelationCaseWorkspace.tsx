import { CandidateAccessControls } from "@/components/CandidateAccessControls";
import { ChatBox } from "@/components/ChatBox";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUpload } from "@/components/DocumentUpload";
import { RelationCaseFields } from "@/components/RelationCaseFields";
import type { RelationPriority, RelationStatus } from "@prisma/client";

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
  auditLogs: Array<{ id: string; eventType: string; createdAt: Date | string }>;
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

function getActivityEvents(item: RelationCaseWorkspaceItem) {
  const events = [
    {
      id: `case-${item.id}`,
      label: "Dossier cree",
      date: item.createdAt,
      type: "Dossier",
    },
    ...item.messages.map((message) => ({
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
      .map((document) => ({
        id: `document-${document.id}`,
        label:
          document.uploadedByEmail === item.candidateEmail
            ? "Document ajoute par candidat"
            : "Document ajoute par proprietaire",
        date: document.createdAt!,
        type: "Document",
      })),
  ];

  return events
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
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
      <div className="mt-6 rounded-2xl border bg-white p-4 sm:p-5 lg:p-4">
        <h2 className="font-semibold">Activite du dossier</h2>
        <div className="mt-3 space-y-2">
          {activityEvents.map((event) => (
            <div
              key={event.id}
              className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div>
                <p className="font-medium text-slate-800">{event.label}</p>
                <p className="text-xs text-slate-500">{event.type}</p>
              </div>
              <p className="shrink-0 text-xs text-slate-500">{formatActivityDate(event.date)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-[1fr_360px] lg:gap-6">
        <ChatBox
          key={item.id}
          caseId={candidateAccessToken ? undefined : item.id}
          candidateAccessToken={candidateAccessToken}
          initialMessages={item.messages}
          senderEmail={senderEmail}
          senderType={senderType}
        />
        <aside className="space-y-4">
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
              <div className="mt-3 space-y-2">
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
