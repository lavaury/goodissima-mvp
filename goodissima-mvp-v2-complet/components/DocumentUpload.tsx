"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function DocumentUpload({
  caseId,
  candidateAccessToken,
  uploadedByEmail,
}: {
  caseId?: string;
  candidateAccessToken?: string;
  uploadedByEmail: string;
}) {
  const [loading, setLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  async function uploadDocument(file: File | null) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Erreur lors de l'ajout du document");
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
      toast.error("Erreur lors de l'ajout du document");
      return;
    }

    toast.success("Document ajoute");
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (documentInputRef.current) documentInputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5 lg:p-4">
      <h3 className="font-semibold">Ajouter un document</h3>
      <p className="mb-4 text-sm text-slate-500">Photo, image ou PDF. Maximum 10 Mo.</p>

      <input
        ref={photoInputRef}
        id="photo-upload"
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          void uploadDocument(event.target.files?.[0] ?? null);
        }}
      />
      <input
        ref={documentInputRef}
        id="document-upload"
        className="sr-only"
        type="file"
        accept=".pdf,image/*"
        onChange={(event) => {
          void uploadDocument(event.target.files?.[0] ?? null);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={loading}
          className="min-h-14 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Upload en cours..." : "📷 Prendre une photo"}
        </button>
        <button
          type="button"
          onClick={() => documentInputRef.current?.click()}
          disabled={loading}
          className="min-h-14 w-full rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Upload en cours..." : "📄 Choisir un document"}
        </button>
      </div>
    </div>
  );
}
