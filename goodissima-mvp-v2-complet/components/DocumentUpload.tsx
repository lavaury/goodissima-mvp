"use client";
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = "image/*,.pdf";

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
  const toast = useToast();

  async function addDocument() {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Erreur lors de l’ajout du document");
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
      toast.error("Erreur lors de l’ajout du document");
      return;
    }

    toast.success("Document ajouté");
    window.setTimeout(() => window.location.reload(), 700);
  }

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5 lg:p-4">
      <h3 className="font-semibold">Ajouter un document</h3>
      <p className="mb-3 text-sm text-slate-500">Image ou PDF. Maximum 10 Mo.</p>
      <label htmlFor="document-upload" className="mb-2 block text-sm font-medium text-slate-700">
        Prendre une photo ou choisir un fichier
      </label>
      <input
        id="document-upload"
        className="mb-3 w-full rounded-xl border px-3 py-3 text-sm"
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        onClick={addDocument}
        disabled={!file || loading}
        className="min-h-12 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 sm:w-auto lg:min-h-0 lg:py-2"
      >
        {loading ? "Upload en cours..." : "Ajouter"}
      </button>
    </div>
  );
}
