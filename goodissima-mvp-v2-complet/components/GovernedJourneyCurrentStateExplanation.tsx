"use client";
import { useState, useTransition } from "react";
import { explainGovernedJourneyCurrentStateAction } from "@/lib/ai/governance/explain-current-state-action";
import type { CurrentStateExplainResult } from "@/lib/ai/governance/explain-current-state-action";

export function GovernedJourneyCurrentStateExplanation({ journeyId }: { journeyId: string }) {
  const [result, setResult] = useState<CurrentStateExplainResult | null>(null);
  const [visible, setVisible] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    if (pending) return;
    setVisible(true);
    setResult(null);
    startTransition(async () => setResult(await explainGovernedJourneyCurrentStateAction(journeyId)));
  }

  return <div className="mt-5 border-t border-slate-200 pt-4">
    <button type="button" disabled={pending} onClick={generate} className="inline-flex min-h-11 items-center rounded-lg border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-900 hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60">
      {result?.explanation ? "Actualiser l’explication" : "Expliquer la situation"}
    </button>
    {visible ? <div role="status" aria-live="polite" className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-slate-800">
      {pending ? <p>Génération de l’explication...</p> : result?.error ? <p>{result.error}</p> : result?.explanation ? <>
        <p className="leading-relaxed">{result.explanation}</p>
        {result.generatedByAI ? <p className="mt-3 text-xs text-slate-600">Explication générée par IA à partir de l’état gouverné du Parcours.{result.generatedAt ? ` Générée à ${new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(new Date(result.generatedAt))}.` : ""}</p> : <p className="mt-3 text-xs text-slate-600">Message fondé sur l’état gouverné du Parcours, sans appel à l’IA.</p>}
      </> : null}
      {!pending ? <button type="button" onClick={() => setVisible(false)} className="mt-3 min-h-11 text-sm font-semibold text-cyan-900 underline underline-offset-4">Masquer l’explication</button> : null}
    </div> : null}
  </div>;
}
