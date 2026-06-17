"use client";

import { useEffect, useState } from "react";
import { AIEmptyState } from "@/components/AIEmptyState";
import { useToast } from "@/components/ToastProvider";
import type { AIDraft, AIDraftType } from "@/lib/ai/types";

type DraftResponse = {
  provider: string;
  model: string;
  promptVersion: string;
  draft: AIDraft;
};

const draftOptions: Array<{ type: AIDraftType; label: string }> = [
  { type: "FOLLOW_UP", label: "Proposer une relance" },
  { type: "DOCUMENT_REQUEST", label: "Proposer une demande document" },
  { type: "CLARIFICATION_REQUEST", label: "Proposer une clarification" },
  { type: "INVESTOR_REPLY", label: "Proposer une reponse investisseur" },
  { type: "PROFESSIONAL_RESPONSE", label: "Proposer une reponse professionnelle" },
];

export function AIDraftAssistantPanel({ caseId, workspace = false }: { caseId: string; workspace?: boolean }) {
  const toast = useToast();
  const [draftType, setDraftType] = useState<AIDraftType>("FOLLOW_UP");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [usingDraft, setUsingDraft] = useState(false);
  const [result, setResult] = useState<DraftResponse | null>(null);

  useEffect(() => {
    function prefillDraft(event: Event) {
      const detail = (event as CustomEvent<{ caseId?: string; draftType?: AIDraftType; instruction?: string }>).detail;
      if (detail?.caseId !== caseId || !detail.draftType) return;

      setDraftType(detail.draftType);
      setInstruction(detail.instruction ?? "");
      setResult(null);
    }

    window.addEventListener("goodissima:prepare-ai-draft", prefillDraft);
    return () => window.removeEventListener("goodissima:prepare-ai-draft", prefillDraft);
  }, [caseId]);

  async function generateDraft(nextType = draftType) {
    setLoading(true);

    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftType: nextType, instruction }),
      });

      if (!res.ok) {
        toast.error("Brouillon indisponible");
        return;
      }

      setResult((await res.json()) as DraftResponse);
      toast.success("Brouillon genere");
    } catch {
      toast.error("Brouillon indisponible");
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft() {
    if (!result) return;
    await navigator.clipboard.writeText(result.draft.message);
    toast.success("Brouillon copie");
  }

  async function useDraftInConversation() {
    if (!result || usingDraft) return;
    setUsingDraft(true);

    window.dispatchEvent(
      new CustomEvent("goodissima:use-ai-draft", {
        detail: { caseId, message: result.draft.message },
      }),
    );

    try {
      await fetch(`/api/cases/${encodeURIComponent(caseId)}/ai-draft-used`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftType: result.draft.draftType }),
      });
    } finally {
      setUsingDraft(false);
      toast.success("Brouillon place dans l'editeur");
    }
  }

  return (
    <section className={workspace ? "h-full" : "rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Assistant redaction IA</h2>
          <p className="mt-1 text-xs text-slate-500">
            Brouillons uniquement. Aucun message ni email n'est envoye automatiquement.
          </p>
        </div>
        {result ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {result.provider} / {result.model}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <select
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
          value={draftType}
          onChange={(event) => setDraftType(event.target.value as AIDraftType)}
        >
          {draftOptions.map((option) => (
            <option key={option.type} value={option.type}>
              {option.label}
            </option>
          ))}
        </select>
        <textarea
          className="min-h-20 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Reformuler un message ou ajouter une consigne optionnelle..."
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
        />
        <button
          type="button"
          onClick={() => void generateDraft()}
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Generation..." : "Generer un brouillon"}
        </button>
      </div>

      {!result ? (
        <AIEmptyState
          title="Brouillon assiste disponible"
          description="Choisissez une intention, ajoutez une consigne si utile, puis generelez un brouillon a copier ou placer dans l'editeur."
          suggestions={["Aucun envoi automatique", "Ton professionnel", "Utilisation auditee"]}
        />
      ) : null}

      {result ? (
        <div className={workspace ? "mt-5 grid gap-4 text-sm" : "mt-4 grid gap-3 text-sm"}>
          <section className="rounded-xl border bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {result.draft.draftType}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {result.draft.tone}
              </span>
            </div>
            {result.draft.subject ? <p className="mt-3 font-medium text-slate-800">{result.draft.subject}</p> : null}
            <p className="mt-2 whitespace-pre-wrap text-slate-700">{result.draft.message}</p>
          </section>

          {result.draft.warnings.length ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase text-amber-800">Avertissements</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
                {result.draft.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyDraft()}
              className="rounded-xl border px-3 py-2 text-xs font-medium text-slate-700"
            >
              Copier
            </button>
            <button
              type="button"
              onClick={() => void useDraftInConversation()}
              disabled={usingDraft}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
            >
              Utiliser dans la conversation
            </button>
            <button
              type="button"
              onClick={() => void generateDraft(result.draft.draftType)}
              disabled={loading}
              className="rounded-xl border px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-60"
            >
              Regenerer
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
