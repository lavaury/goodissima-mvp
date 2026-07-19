"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

type MatchItem = {
  relationId: string;
  pseudonym: string;
  explanation: {
    compatibleElements: string[];
    semanticSignals?: string[];
    clarificationsNeeded: string[];
    warnings: string[];
  };
};

export function GLinkMatchingPanel({
  linkId,
  criteriaSufficient,
  initialMatches,
  initialAnalyzed,
  initialEnabled,
}: {
  linkId: string;
  criteriaSufficient: boolean;
  initialMatches: MatchItem[];
  initialAnalyzed: boolean;
  initialEnabled: boolean;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState(initialMatches);
  const [analyzed, setAnalyzed] = useState(initialAnalyzed);
  const [decisions, setDecisions] = useState<Record<string, "INTERESTING" | "IGNORED">>({});
  const [enabled, setEnabled] = useState(initialEnabled);

  async function changeEnabled(nextEnabled: boolean) {
    if (nextEnabled && !window.confirm("Activer le matching relationnel pour ce lien ? L’analyse restera déclenchée manuellement et aucun contact automatique ne sera créé.")) return;
    const response = await fetch(`/api/links/${encodeURIComponent(linkId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "matching", matchingEnabled: nextEnabled }),
    });
    if (!response.ok) {
      toast.error("État du matching non modifié");
      return;
    }
    setEnabled(nextEnabled);
    if (!nextEnabled) {
      setMatches([]);
      setAnalyzed(false);
    }
    toast.success(nextEnabled ? "Matching activé. Analyse manuelle disponible." : "Matching désactivé.");
  }

  async function analyze() {
    setLoading(true);
    const response = await fetch(`/api/links/${encodeURIComponent(linkId)}/matching`, { method: "POST" });
    setLoading(false);
    if (!response.ok) {
      toast.error("Analyse des correspondances indisponible");
      return;
    }
    const payload = await response.json() as { matches: MatchItem[] };
    setMatches(payload.matches);
    setAnalyzed(true);
    toast.success("Correspondances actualisées");
  }

  async function decide(targetId: string, decision: "INTERESTING" | "IGNORED") {
    const response = await fetch(`/api/links/${encodeURIComponent(linkId)}/matching`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, decision }),
    });
    if (!response.ok) {
      toast.error("Décision non enregistrée");
      return;
    }
    setDecisions((current) => ({ ...current, [targetId]: decision }));
    toast.success(decision === "INTERESTING" ? "Correspondance marquée intéressante" : "Correspondance ignorée");
  }

  return (
    <section id="matching" data-boussole-id="link-matching-status" data-boussole-state={enabled ? analyzed ? matches.length ? "matches" : "no-results" : "to-analyze" : "disabled"} className="mt-6 scroll-mt-6 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[#247f88]">Matching du lien</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Correspondances potentielles à examiner</h2>
          <p className="mt-1 text-sm text-slate-500">Analyse prudente du besoin initial. Aucun contact automatique.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-2 text-xs font-bold ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>Matching relationnel : {enabled ? "Activé" : "Désactivé"}</span>
          <button type="button" data-boussole-id={enabled ? "disable-link-matching" : "enable-link-matching"} onClick={() => changeEnabled(!enabled)} className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-700">{enabled ? "Désactiver" : "Activer le matching"}</button>
          {enabled ? <button type="button" data-boussole-id="analyze-link-matching" onClick={analyze} disabled={loading || !criteriaSufficient} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {loading ? "Analyse sémantique en cours d’actualisation" : analyzed ? "Régénérer les correspondances" : "Analyser les correspondances"}
          </button> : null}
        </div>
      </div>
      {!enabled ? <p className="mt-5 rounded-xl border border-dashed p-4 text-sm text-slate-600">Activez explicitement le matching pour rendre l’analyse disponible. Aucune analyse n’est lancée automatiquement.</p> : null}
      {enabled && !criteriaSufficient ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Ajoutez ou précisez des critères pour permettre une analyse utile.</p> : null}
      {enabled && criteriaSufficient && !analyzed ? <p className="mt-5 rounded-xl border border-dashed p-4 text-sm text-slate-600">Le besoin de ce lien peut être analysé.</p> : null}
      {enabled && analyzed && matches.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune correspondance exploitable pour le moment.</p> : null}
      {enabled && matches.length ? <div className="mt-5 space-y-3">
        <p className="text-sm font-semibold text-slate-700">{matches.length} correspondance{matches.length > 1 ? "s" : ""} à examiner humainement</p>
        {matches.filter((match) => decisions[match.relationId] !== "IGNORED").map((match) => <article key={match.relationId} data-boussole-id="review-link-matches" className="rounded-xl border bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><h3 className="font-bold text-slate-950">{match.pseudonym}</h3><p className="mt-1 text-xs text-slate-500">Aucune identité révélée · aucun score présenté comme vérité</p></div>
            <div className="flex gap-2">
              <button type="button" data-boussole-id="decide-link-match" onClick={() => decide(match.relationId, "INTERESTING")} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800">{decisions[match.relationId] === "INTERESTING" ? "Intéressante" : "Marquer intéressante"}</button>
              <button type="button" onClick={() => decide(match.relationId, "IGNORED")} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-600">Ignorer</button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <MatchList title="Éléments compatibles" items={match.explanation.compatibleElements} />
            <MatchList title="Signaux relationnels" items={match.explanation.semanticSignals ?? []} />
            <MatchList title="Clarifications nécessaires" items={match.explanation.clarificationsNeeded} />
            <MatchList title="Points de vigilance" items={match.explanation.warnings} />
          </div>
        </article>)}
      </div> : null}
    </section>
  );
}

function MatchList({ title, items }: { title: string; items: string[] }) {
  return items.length ? <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold text-[#247f88]">{title}</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">{items.map((item) => <li key={item}>{item}</li>)}</ul></div> : null;
}
