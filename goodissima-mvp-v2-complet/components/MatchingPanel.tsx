"use client";

import { useEffect, useState } from "react";
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

export function MatchingPanel({ caseId, matchingEnabled }: { caseId: string; matchingEnabled: boolean }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(matchingEnabled);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    function updateMatching(event: Event) {
      const detail = (event as CustomEvent<{ caseId?: string; matchingEnabled?: boolean }>).detail;
      if (detail?.caseId === caseId && typeof detail.matchingEnabled === "boolean") {
        setEnabled(detail.matchingEnabled);
      }
    }

    window.addEventListener("goodissima:matching-opt-in", updateMatching);
    return () => window.removeEventListener("goodissima:matching-opt-in", updateMatching);
  }, [caseId]);

  async function analyze() {
    setLoading(true);
    const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/matching`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      toast.error(enabled ? "Correspondances indisponibles" : "Activez le matching pour ce dossier");
      return;
    }

    const payload = (await res.json()) as { matches: MatchItem[]; semanticMatches?: MatchItem[]; warnings?: string[] };
    setMatches(payload.semanticMatches?.length ? payload.semanticMatches : payload.matches);
    setWarnings(payload.warnings ?? []);
    toast.success("Correspondances analysees");
  }

  async function propose(match: MatchItem) {
    setProposingId(match.relationId);
    const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/matching-proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetRelationId: match.relationId }),
    });
    setProposingId(null);

    if (!res.ok) {
      toast.error("Proposition non creee");
      return;
    }

    toast.success("Suggestion relationnelle creee");
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4">
      <h2 className="font-semibold">Correspondances potentielles</h2>
      <p className="mt-1 text-xs text-slate-500">
        Pseudonymisees, explicables, sans score visible et sans contact automatique.
      </p>
      <button
        type="button"
        onClick={analyze}
        disabled={loading || !enabled}
        className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Analyse..." : "Analyser les correspondances"}
      </button>

      <div className="mt-4 space-y-3">
        {warnings.map((warning) => (
          <p key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {warning}
          </p>
        ))}
        {matches.map((match) => (
          <article key={match.relationId} className="rounded-xl border bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-900">{match.pseudonym}</p>
            {match.explanation.semanticSignals?.length ? (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                Correspondance semantique detectee
              </p>
            ) : null}
            <MatchList title="Elements compatibles" items={match.explanation.compatibleElements} />
            <MatchList title="Signaux relationnels" items={match.explanation.semanticSignals ?? []} />
            <MatchList title="Clarifications necessaires" items={match.explanation.clarificationsNeeded} />
            <MatchList title="Vigilance" items={match.explanation.warnings} />
            <button
              type="button"
              onClick={() => void propose(match)}
              disabled={proposingId === match.relationId}
              className="mt-3 rounded-xl border px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              {proposingId === match.relationId ? "Proposition..." : "Proposer une relation"}
            </button>
          </article>
        ))}
        {matches.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            Lancez l'analyse pour afficher les correspondances opt-in.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function MatchList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
