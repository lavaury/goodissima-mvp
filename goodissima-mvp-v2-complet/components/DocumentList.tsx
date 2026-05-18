"use client";

import { useToast } from "@/components/ToastProvider";

export function DocumentList({
  documents,
  caseId,
  candidateAccessToken,
}: {
  documents: Array<{ id: string; fileName: string }>;
  caseId?: string;
  candidateAccessToken?: string;
}) {
  const toast = useToast();

  async function openDocument(documentId: string) {
    const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, candidateAccessToken }),
    });

    if (!res.ok) {
      toast.error("Erreur lors de l'action");
      return;
    }

    const { signedUrl } = await res.json();
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  }

  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">Aucun document.</p>;
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => openDocument(doc.id)}
          className="block min-h-12 w-full rounded-xl border bg-white px-3 py-3 text-left text-sm leading-snug hover:bg-slate-50"
        >
          <span className="block truncate font-medium text-slate-800">{doc.fileName}</span>
          <span className="mt-0.5 block text-xs text-slate-500">Ouvrir le document</span>
        </button>
      ))}
    </div>
  );
}
