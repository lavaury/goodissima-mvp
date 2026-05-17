import { CandidateAccessControls } from "@/components/CandidateAccessControls";
import { ChatBox } from "@/components/ChatBox";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUpload } from "@/components/DocumentUpload";

type RelationCaseWorkspaceItem = {
  id: string;
  candidateAccessToken: string;
  candidateAccessExpiresAt?: Date | string | null;
  candidateAccessRevokedAt?: Date | string | null;
  candidateName: string;
  candidateEmail: string;
  gLink: { title: string };
  messages: Array<{ id: string; body: string; senderEmail: string; createdAt: Date | string }>;
  documents: Array<{ id: string; fileUrl: string; fileName: string }>;
  auditLogs: Array<{ id: string; eventType: string; createdAt: Date | string }>;
};

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
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-bold">{item.gLink.title}</h1>
      <p className="text-slate-500">
        Dossier avec {item.candidateName} - {item.candidateEmail}
      </p>
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
