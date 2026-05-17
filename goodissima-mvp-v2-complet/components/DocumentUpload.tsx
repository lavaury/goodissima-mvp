"use client";
import { useState } from "react";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.docx";

export function DocumentUpload({
  caseId,
  candidateAccessToken,
  uploadedByEmail,
}: {
  caseId?: string;
  candidateAccessToken?: string;
  uploadedByEmail: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function addDocument() {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert("Le fichier ne doit pas depasser 10 Mo.");
      return;
    }

    const formData = new FormData();
    if (caseId) formData.append("caseId", caseId);
    if (candidateAccessToken) formData.append("candidateAccessToken", candidateAccessToken);
    formData.append("uploadedByEmail", uploadedByEmail);
    formData.append("file", file);

    setLoading(true);

    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    setLoading(false);

    if (!res.ok) {
      alert("Erreur lors de l'ajout du document.");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="font-semibold">Ajouter un document</h3>
      <p className="mb-3 text-sm text-slate-500">PDF, JPG, PNG ou DOCX. Maximum 10 Mo.</p>
      <input
        className="mb-3 w-full rounded-xl border px-3 py-2"
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        onClick={addDocument}
        disabled={!file || loading}
        className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? "Upload en cours..." : "Ajouter"}
      </button>
    </div>
  );
}
