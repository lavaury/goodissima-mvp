"use client";

import { useEffect, useState } from "react";
import { AIEmptyState } from "@/components/AIEmptyState";
import { MergeOpportunitiesSection } from "@/components/MergeOpportunitiesSection";
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

function formatMatches(matches: MatchItem[], warnings: string[]) {
  return [
    warnings.length ? `Warnings:\n- ${warnings.join("\n- ")}` : "",
    ...matches.map((match) =>
      [
        `Correspondance: ${match.pseudonym}`,
        match.explanation.compatibleElements.length
          ? `Elements compatibles:\n- ${match.explanation.compatibleElements.join("\n- ")}`
          : "",
        match.explanation.semanticSignals?.length
          ? `Signaux relationnels:\n- ${match.explanation.semanticSignals.join("\n- ")}`
          : "",
        match.explanation.clarificationsNeeded.length
          ? `Clarifications:\n- ${match.explanation.clarificationsNeeded.join("\n- ")}`
          : "",
        match.explanation.warnings.length ? `Vigilance:\n- ${match.explanation.warnings.join("\n- ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function MatchingPanel({
  caseId,
  matchingEnabled,
  workspace = false,
  debugMode = false,
}: {
  caseId: string;
  matchingEnabled: boolean;
  workspace?: boolean;
  debugMode?: boolean;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(matchingEnabled);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

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
    setAnalysisComplete(true);
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

  async function copyMatches() {
    if (!matches.length && !warnings.length) return;
    await navigator.clipboard.writeText(formatMatches(matches, warnings));
    toast.success("Matching copie");
  }

  return (
    <section id="matching" data-boussole-id="candidate-case-matching" className={workspace ? "h-full" : "rounded-2xl border border-[#e7e0d6] bg-[#fffcf8] p-4 shadow-[0_12px_32px_rgba(24,33,56,0.06)] sm:p-5 lg:p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#2f3437]">Correspondances potentielles</h2>
          <p className="mt-1 text-xs text-[#746d66]">
            Pseudonymisees, explicables, sans score visible et sans contact automatique.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f8f9] px-3 py-1 text-xs font-medium text-[#247f88] ring-1 ring-[#c9e7ea]">
          <NetworkIcon />
          Privacy-first
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={analyze}
          disabled={loading || !enabled}
          className="inline-flex items-center gap-2 rounded-full bg-[#263846] px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-[#2f4858] disabled:translate-y-0 disabled:opacity-50"
        >
          {loading ? <span className="h-2 w-2 animate-pulse rounded-full bg-[#c9e7ea]" /> : null}
          {loading ? "Analyse..." : matches.length ? "Regenerer les correspondances" : "Analyser les correspondances"}
        </button>
        <button
          type="button"
          onClick={copyMatches}
          disabled={!matches.length && !warnings.length}
          className="rounded-full border border-[#d6e7e8] bg-white px-4 py-2 text-sm font-medium text-[#2f3437] transition hover:bg-[#e8f8f9] disabled:opacity-50"
        >
          Copier
        </button>
      </div>

      <div className={workspace ? "mt-5 space-y-4" : "mt-4 space-y-3"}>
        {warnings.map((warning) => (
          <p key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {warning}
          </p>
        ))}
        {matches.map((match) => (
          <article key={match.relationId} className="rounded-2xl border border-[#e7e0d6] bg-[#f6f0e8] p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fbf7f1] hover:shadow-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-semibold text-[#2f3437]">{match.pseudonym}</p>
                <p className="mt-1 text-xs text-[#766f68]">
                  Proposition relationnelle possible apres revue humaine.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void propose(match)}
                disabled={proposingId === match.relationId}
                className="shrink-0 rounded-full border border-[#d6e7e8] bg-white px-3 py-2 text-xs font-medium text-[#2f3437] transition hover:bg-[#e8f8f9] disabled:opacity-50"
              >
                {proposingId === match.relationId ? "Proposition..." : "Proposer une relation"}
              </button>
            </div>
            {match.explanation.semanticSignals?.length ? (
              <p className="mt-3 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                Correspondance semantique detectee
              </p>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <MatchList title="Elements compatibles" items={match.explanation.compatibleElements} />
              <MatchList title="Signaux relationnels" items={match.explanation.semanticSignals ?? []} />
              <MatchList title="Clarifications necessaires" items={match.explanation.clarificationsNeeded} />
              <MatchList title="Warnings" items={match.explanation.warnings} />
            </div>
          </article>
        ))}
        {matches.length === 0 ? (
          <AIEmptyState
            title="Matching gouverne en attente"
            description="Le matching relationnel analysera uniquement les dossiers opt-in, sans score visible ni revelation automatique d'identite."
            suggestions={["Correspondances pseudonymisees", "Signaux relationnels", "Clarifications avant proposition"]}
          />
        ) : null}
      </div>
      <MergeOpportunitiesSection caseId={caseId} active={analysisComplete} debugMode={debugMode} />
    </section>
  );
}

function MatchList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-[#d6e7e8] transition hover:ring-[#2fb8c4]/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#247f88]">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[#3f4548]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function NetworkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6" cy="8" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <circle cx="12" cy="17" r="2.5" />
      <path d="M8.2 9.4l2.6 5.1M15.8 9.4l-2.6 5.1M8.5 8h7" />
    </svg>
  );
}
