"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

async function getApiErrorMessage(res: Response) {
  try {
    const body = await res.json();
    const message = typeof body.error === "string" ? body.error : "Erreur lors de l'ajout du document";
    const stage = typeof body.stage === "string" ? body.stage : null;
    const code = typeof body.code === "string" ? body.code : null;
    return [stage ? `Etape ${stage}` : null, code, message].filter(Boolean).join(" - ");
  } catch {
    return "Erreur lors de l'ajout du document";
  }
}

export function DocumentUpload({
  caseId,
  candidateAccessToken,
  disabled = false,
  disabledReason,
  uploadedByEmail,
}: {
  caseId?: string;
  candidateAccessToken?: string;
  disabled?: boolean;
  disabledReason?: string;
  uploadedByEmail?: string;
}) {
  const [loading, setLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mobileDocumentInputRef = useRef<HTMLInputElement>(null);
  const desktopDocumentInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  async function uploadDocument(file: File | null) {
    if (!file || disabled) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Le document depasse 10 Mo");
      return;
    }

    const formData = new FormData();
    if (caseId) formData.append("caseId", caseId);
    if (candidateAccessToken) formData.append("candidateAccessToken", candidateAccessToken);
    if (uploadedByEmail) formData.append("uploadedByEmail", uploadedByEmail);
    formData.append("file", file);

    setLoading(true);

    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    setLoading(false);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res));
      return;
    }

    toast.success("Document ajoute");
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (mobileDocumentInputRef.current) mobileDocumentInputRef.current.value = "";
    if (desktopDocumentInputRef.current) desktopDocumentInputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 lg:p-4">
      <h3 className="font-semibold">Ajouter un document</h3>
      <p className="mb-4 text-sm text-slate-500">
        Vos fichiers sont ajoutés dans l'espace sécurisé du dossier. Maximum 10 Mo.
      </p>
      {disabled ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {disabledReason ?? "L'ajout de documents est bloque pour cette relation."}
        </p>
      ) : null}

      <input ref={photoInputRef} id="photo-upload" className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)} />
      <input ref={imageInputRef} id="image-upload" className="sr-only" type="file" accept="image/*" onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)} />
      <input ref={mobileDocumentInputRef} id="mobile-document-upload" className="sr-only" type="file" accept="application/pdf,.pdf,.doc,.docx" onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)} />
      <input ref={desktopDocumentInputRef} id="desktop-document-upload" className="sr-only" type="file" accept="application/pdf,.pdf,.doc,.docx,image/*" onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)} />

      <div className="grid gap-3 md:hidden">
        <button type="button" onClick={() => photoInputRef.current?.click()} disabled={disabled || loading} className="min-h-14 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60">
          {loading ? "Ajout en cours..." : "Prendre une photo"}
        </button>
        <button type="button" onClick={() => imageInputRef.current?.click()} disabled={disabled || loading} className="min-h-14 w-full rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60">
          {loading ? "Ajout en cours..." : "Choisir une image existante"}
        </button>
        <button type="button" onClick={() => mobileDocumentInputRef.current?.click()} disabled={disabled || loading} className="min-h-14 w-full rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60">
          {loading ? "Ajout en cours..." : "Choisir un PDF ou fichier"}
        </button>
      </div>

      <div className="hidden md:block">
        <button type="button" onClick={() => desktopDocumentInputRef.current?.click()} disabled={disabled || loading} className="min-h-10 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60">
          {loading ? "Ajout en cours..." : "Ajouter un document"}
        </button>
        <p className="mt-2 text-xs text-slate-500">PDF, DOC, DOCX ou image.</p>
      </div>
    </div>
  );
}
