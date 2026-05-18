"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export default function CandidateForm({ gLinkId, slug }: { gLinkId: string; slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    gLinkId,
    candidateName: "",
    candidateEmail: "",
    message: "",
    documentName: "",
    documentUrl: "",
  });

  async function submit() {
    if (!form.candidateName.trim() || !form.candidateEmail.trim() || !form.message.trim()) {
      toast.error("Erreur lors de l'action");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);

    if (!res.ok) {
      toast.error("Erreur lors de l'action");
      return;
    }

    toast.success("Message envoye");
    const relationCase = await res.json();
    router.push(`/l/${slug}/confirmation?token=${encodeURIComponent(relationCase.candidateAccessToken)}`);
  }

  return (
    <div className="mt-6 space-y-4">
      <input
        className="w-full rounded-xl border px-4 py-3"
        placeholder="Votre nom"
        value={form.candidateName}
        onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
      />
      <input
        className="w-full rounded-xl border px-4 py-3"
        placeholder="Votre email"
        value={form.candidateEmail}
        onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })}
      />
      <textarea
        className="min-h-32 w-full rounded-xl border px-4 py-3"
        placeholder="Presentez-vous et indiquez votre demande"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
      />
      <div className="rounded-2xl border p-4">
        <p className="mb-2 text-sm font-medium">Document optionnel</p>
        <p className="mb-3 text-sm text-slate-500">
          Vous pouvez ajouter un lien vers un document si le proprietaire l'a demande.
        </p>
        <input
          className="mb-2 w-full rounded-xl border px-4 py-3"
          placeholder="Nom du document"
          value={form.documentName}
          onChange={(e) => setForm({ ...form, documentName: e.target.value })}
        />
        <input
          className="w-full rounded-xl border px-4 py-3"
          placeholder="URL du document"
          value={form.documentUrl}
          onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}
        />
      </div>
      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
      >
        {loading ? "Envoi en cours..." : "Envoyer ma demande"}
      </button>
    </div>
  );
}
