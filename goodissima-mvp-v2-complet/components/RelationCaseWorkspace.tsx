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

function formatActivityDate(date: Date | string) {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActivityEvents(item: RelationCaseWorkspaceItem) {
  const events = [
    {
      id: `case-${item.id}`,
      label: "Dossier créé",
      date: item.createdAt,
      type: "Dossier",
    },
    ...item.messages.map((message) => ({
      id: `message-${message.id}`,
      label:
        message.senderType === "OWNER"
          ? "Message envoyé par propriétaire"
          : "Message envoyé par candidat",
      date: message.createdAt,
      type: "Message",
    })),
    ...item.documents
      .filter((document) => document.createdAt)
      .map((document) => ({
        id: `document-${document.id}`,
        label:
          document.uploadedByEmail === item.candidateEmail
            ? "Document ajouté par candidat"
            : "Document ajouté par propriétaire",
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

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-bold">{item.gLink.title}</h1>
      <p className="text-slate-500">
        Dossier avec {item.candidateName} - {item.candidateEmail}
      </p>
      <RelationCaseFields
        caseId={item.id}
        priority={item.priority}
        status={item.status}
        editable={senderType === "OWNER"}
      />
      <div className="mt-6 rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">Activité du dossier</h2>
        <div className="mt-3 space-y-2">
          {activityEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{event.label}</p>
                <p className="text-xs text-slate-500">{event.type}</p>
              </div>
              <p className="shrink-0 text-xs text-slate-500">{formatActivityDate(event.date)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <ChatBox
          caseId={candidateAccessToken ? undefined : item.id}
          candidateAccessToken={candidateAccessToken}
          initialMessages={item.messages}
          senderEmail={senderEmail}
          senderType={senderType}
        />
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-4">
            <h2 className="font-semibold">Documents</h2>
            <div className="mt-3 space-y-2">
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
          <div className="rounded-2xl border bg-white p-4">
            <h2 className="font-semibold">Historique minimal</h2>
            <div className="mt-3 space-y-2">
              {item.auditLogs.map((log) => (
                <div key={log.id} className="rounded-xl bg-slate-50 p-2 text-xs">
                  <p className="font-medium">{log.eventType}</p>
                  <p className="text-slate-500">
                    {new Date(log.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
