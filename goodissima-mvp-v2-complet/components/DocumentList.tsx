"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type CaseDocument = { id: string; fileName: string };

export function DocumentList({
  documents,
  caseId,
  candidateAccessToken,
}: {
  documents: CaseDocument[];
  caseId?: string;
  candidateAccessToken?: string;
}) {
  const [freshDocuments, setFreshDocuments] = useState(documents);
  const toast = useToast();

  const loadDocuments = useCallback(async () => {
    if (!candidateAccessToken && !caseId) {
      console.error("DocumentList.loadDocuments missing case reference", {
        caseId,
        hasCandidateAccessToken: Boolean(candidateAccessToken),
      });
      return;
    }

    const query = candidateAccessToken
      ? `candidateAccessToken=${encodeURIComponent(candidateAccessToken)}`
      : `caseId=${encodeURIComponent(caseId!)}`;

    try {
      const res = await fetch(`/api/documents?${query}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("DocumentList.loadDocuments failed", {
          status: res.status,
          caseId,
          hasCandidateAccessToken: Boolean(candidateAccessToken),
        });
        return;
      }

      const nextDocuments = (await res.json()) as CaseDocument[];
      setFreshDocuments(nextDocuments);
    } catch (error) {
      console.error("DocumentList.loadDocuments error", {
        error,
        caseId,
        hasCandidateAccessToken: Boolean(candidateAccessToken),
      });
    }
  }, [caseId, candidateAccessToken]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    setFreshDocuments(documents);
  }, [documents]);

  useEffect(() => {
    function refreshDocuments(event: Event) {
      const detail = (event as CustomEvent<{ caseId?: string; candidateAccessToken?: string }>).detail;
      const sameOwnerCase = Boolean(caseId && detail?.caseId === caseId);
      const sameCandidateCase = Boolean(candidateAccessToken && detail?.candidateAccessToken === candidateAccessToken);

      if (!sameOwnerCase && !sameCandidateCase) return;
      void loadDocuments();
    }

    window.addEventListener("goodissima:documents-updated", refreshDocuments);
    return () => window.removeEventListener("goodissima:documents-updated", refreshDocuments);
  }, [caseId, candidateAccessToken, loadDocuments]);

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

  if (freshDocuments.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Aucun document partagé pour l'instant. Les pièces ajoutées ici resteront accessibles via un lien sécurisé.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {freshDocuments.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => openDocument(doc.id)}
          className="block min-h-12 w-full rounded-xl border bg-white px-3 py-3 text-left text-sm leading-snug transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"
        >
          <span className="block truncate font-medium text-slate-800">{doc.fileName}</span>
          <span className="mt-0.5 block text-xs text-slate-500">Ouvrir le document</span>
        </button>
      ))}
    </div>
  );
}
