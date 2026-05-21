"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

type CandidateFormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  defaultValue: string | null;
};

const supportedFieldTypes = new Set(["TEXT", "EMAIL", "TEXTAREA"]);

function createInitialAnswers(fields: CandidateFormField[]) {
  return fields.reduce<Record<string, string>>((answers, field) => {
    answers[field.key] = field.defaultValue ?? "";
    return answers;
  }, {});
}

export default function CandidateForm({
  gLinkId,
  formTemplateId,
  fields,
}: {
  gLinkId: string;
  formTemplateId: string | null;
  fields: CandidateFormField[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() => createInitialAnswers(fields));
  const [documentFields, setDocumentFields] = useState({
    documentName: "",
    documentUrl: "",
  });

  async function submit() {
    const fullName = answers.fullName?.trim() ?? "";
    const email = answers.email?.trim() ?? "";
    const message = answers.message?.trim() ?? "";

    if (!fullName || !email || !message) {
      toast.error("Erreur lors de l'action");
      return;
    }

    const payload = {
      gLinkId,
      candidateName: fullName,
      candidateEmail: email,
      message,
      documentName: documentFields.documentName,
      documentUrl: documentFields.documentUrl,
      formTemplateId,
      answers: {
        fullName,
        email,
        message,
      },
    };

    setLoading(true);
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!res.ok) {
      toast.error("Erreur lors de l'action");
      return;
    }

    toast.success("Message envoye");
    const relationCase = await res.json();
    router.push(`/secure/${encodeURIComponent(relationCase.candidateAccessToken)}`);
  }

  return (
    <div className="mt-6 space-y-4">
      {fields
        .filter((field) => supportedFieldTypes.has(field.type))
        .map((field) =>
          field.type === "TEXTAREA" ? (
            <textarea
              key={field.key}
              className="min-h-32 w-full rounded-xl border px-4 py-3"
              placeholder={field.placeholder ?? undefined}
              value={answers[field.key] ?? ""}
              onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
            />
          ) : (
            <input
              key={field.key}
              className="w-full rounded-xl border px-4 py-3"
              type={field.type === "EMAIL" ? "email" : "text"}
              placeholder={field.placeholder ?? undefined}
              value={answers[field.key] ?? ""}
              onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
            />
          ),
        )}
      <div className="rounded-2xl border p-4">
        <p className="mb-2 text-sm font-medium">Document optionnel</p>
        <p className="mb-3 text-sm text-slate-500">
          Vous pouvez ajouter un lien vers un document si le proprietaire l'a demande.
        </p>
        <input
          className="mb-2 w-full rounded-xl border px-4 py-3"
          placeholder="Nom du document"
          value={documentFields.documentName}
          onChange={(e) => setDocumentFields({ ...documentFields, documentName: e.target.value })}
        />
        <input
          className="w-full rounded-xl border px-4 py-3"
          placeholder="URL du document"
          value={documentFields.documentUrl}
          onChange={(e) => setDocumentFields({ ...documentFields, documentUrl: e.target.value })}
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
