"use client";

import { useRef, useState } from "react";
import {
  prepareGovernanceReviewWithAIAssistantAction,
  type GovernanceReviewAIHelp,
} from "@/lib/governance-review-ai-actions";

const fields: Array<[keyof GovernanceReviewAIHelp, string]> = [
  ["pointsToExamine", "Points à examiner"],
  ["blockers", "Blocages"],
  ["questionsToDecide", "Questions à trancher"],
  ["humanActions", "Actions humaines possibles"],
  ["limits", "Limites"],
];

function formatHelp(help: GovernanceReviewAIHelp) {
  return [
    "Revue de gouvernance — aide assistant",
    "",
    "Synthèse",
    help.summary,
    ...fields.flatMap(([key, label]) => ["", label, ...(help[key] as string[])]),
  ].join("\n");
}

export function GovernanceReviewAIAssistant(props: {
  formTemplateId: string;
  reason: string;
  question: string;
  humanNote?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState<GovernanceReviewAIHelp | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  async function run() {
    setPending(true);
    setError(null);
    setCopyStatus(null);
    setFallbackText(null);
    const result = await prepareGovernanceReviewWithAIAssistantAction(props);
    setHelp(result.help ?? null);
    setError(result.error ?? null);
    setPending(false);
  }

  async function copyHelp() {
    if (!help) return;

    const text = formatHelp(help);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setFallbackText(null);
      setCopyStatus("Aide copiée");
    } catch {
      setFallbackText(text);
      setCopyStatus("Copie impossible, sélectionnez le texte manuellement");
      window.setTimeout(() => fallbackRef.current?.select(), 0);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[#b9dfe2] bg-white p-3">
      <button type="button" onClick={run} disabled={pending} data-boussole-id="prepare-governance-review" className="rounded-lg bg-[#247f88] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
        {pending ? "Préparation…" : "Préparer avec l’assistant"}
      </button>
      <p className="mt-2 text-xs text-slate-600">L’assistant propose une aide à la préparation. La revue doit être validée par un humain.</p>
      <p className="text-xs text-slate-600">Aucune décision, notification ou réunion n’est déclenchée automatiquement.</p>
      {error ? <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{error}</p> : null}
      {help ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold">
            Synthèse
            <textarea value={help.summary} onChange={(event) => setHelp({ ...help, summary: event.target.value })} className="mt-1 min-h-28 w-full rounded-lg border p-2 text-sm font-normal" />
          </label>
          {fields.map(([key, label]) => (
            <label key={key} className="block text-xs font-bold">
              {label}
              <textarea value={(help[key] as string[]).join("\n")} onChange={(event) => setHelp({ ...help, [key]: event.target.value.split("\n") })} className="mt-1 min-h-20 w-full rounded-lg border p-2 text-sm font-normal" />
            </label>
          ))}
          <button type="button" onClick={copyHelp} data-boussole-id="copy-governance-review-help" className="rounded-lg border px-3 py-2 text-xs font-bold">Copier l’aide</button>
          {copyStatus ? <p role="status" aria-live="polite" className="text-sm text-slate-700">{copyStatus}</p> : null}
          {fallbackText ? (
            <label className="block text-xs font-bold">
              Aide à copier manuellement
              <textarea ref={fallbackRef} readOnly value={fallbackText} onFocus={(event) => event.currentTarget.select()} className="mt-1 min-h-48 w-full rounded-lg border p-2 text-sm font-normal" />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
