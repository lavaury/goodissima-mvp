"use client";

import { useEffect, useState } from "react";

type Scenario = "housing" | "employment";

type MergeOpportunity = {
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  relationalScore: number;
  explanations: string[];
  scoreBreakdown: {
    relationshipScore: number;
    roleScore: number;
    trustScore: number;
    familyScore: number;
    totalScore: number;
  };
  ciro: unknown;
};

type MergeOpportunityResponse = {
  requesterLabel: string;
  opportunities: MergeOpportunity[];
};

export function MergeOpportunitiesSection({
  caseId,
  active,
  debugMode,
}: {
  caseId: string;
  active: boolean;
  debugMode: boolean;
}) {
  const [scenario, setScenario] = useState<Scenario>("housing");
  const [includeNoMatch, setIncludeNoMatch] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [payload, setPayload] = useState<MergeOpportunityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({ scenario });
    if (debugMode && includeNoMatch) query.set("includeNoMatch", "true");
    fetch(`/api/cases/${encodeURIComponent(caseId)}/merge-opportunities?${query}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("MERGE_OPPORTUNITIES_UNAVAILABLE");
        setPayload((await response.json()) as MergeOpportunityResponse);
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [active, caseId, debugMode, includeNoMatch, scenario]);

  useEffect(() => {
    setPresentationIndex(0);
    setShowTechnicalDetails(false);
  }, [payload, presentationMode, scenario]);

  if (!active) return null;

  return (
    <section className="mt-6 border-t border-[#e7e0d6] pt-5" aria-labelledby="merge-opportunities-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#247f88]">Évaluation de compatibilité</p>
          <h3 id="merge-opportunities-title" className="mt-1 font-semibold text-[#2f3437]">Opportunités de fusion</h3>
          <p className="mt-1 text-xs text-[#746d66]">
            Résultats déterministes issus du moteur Merge existant. Les absences de correspondance sont masquées par défaut.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            aria-pressed={presentationMode}
            onClick={() => setPresentationMode((current) => !current)}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              presentationMode
                ? "border-[#247f88] bg-[#247f88] text-white"
                : "border-[#d6e7e8] bg-white text-[#2f3437] hover:bg-[#e8f8f9]",
            ].join(" ")}
          >
            Présentation
          </button>
          <div className="flex rounded-full bg-[#e8f8f9] p-1" aria-label="Scénario de démonstration">
            {(["housing", "employment"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScenario(value)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  scenario === value ? "bg-white text-[#2f3437] shadow-sm" : "text-[#5f686b]",
                ].join(" ")}
              >
                {value === "housing" ? "Location" : "Emploi"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {debugMode ? (
        <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-amber-900">
          <input
            type="checkbox"
            checked={includeNoMatch}
            onChange={(event) => setIncludeNoMatch(event.target.checked)}
            className="h-4 w-4 rounded border-amber-300"
          />
          Afficher les NO_MATCH
        </label>
      ) : null}

      {loading ? <p className="mt-4 text-sm text-[#746d66]">Évaluation des opportunités...</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Opportunités de fusion indisponibles.</p> : null}
      {payload && !loading && !error && presentationMode ? (
        <PresentationFlow
          payload={payload}
          currentIndex={presentationIndex}
          onPrevious={() => setPresentationIndex((current) => Math.max(0, current - 1))}
          onNext={() => setPresentationIndex((current) => Math.min(payload.opportunities.length - 1, current + 1))}
          showTechnicalDetails={showTechnicalDetails}
          onShowTechnicalDetails={() => setShowTechnicalDetails(true)}
        />
      ) : null}
      {payload && !loading && !error && !presentationMode ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-[#746d66]">Demandeur : <span className="font-medium text-[#2f3437]">{payload.requesterLabel}</span></p>
          {payload.opportunities.map((opportunity) => (
            <MergeOpportunityCard key={opportunity.id} opportunity={opportunity} debugMode={debugMode} />
          ))}
          {payload.opportunities.length === 0 ? (
            <p className="rounded-2xl border border-[#e7e0d6] bg-white p-4 text-sm text-[#746d66]">Aucune opportunité affichable.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PresentationFlow({
  payload,
  currentIndex,
  onPrevious,
  onNext,
  showTechnicalDetails,
  onShowTechnicalDetails,
}: {
  payload: MergeOpportunityResponse;
  currentIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  showTechnicalDetails: boolean;
  onShowTechnicalDetails: () => void;
}) {
  const opportunity = payload.opportunities[currentIndex];
  if (!opportunity) {
    return <p className="mt-4 rounded-2xl border border-[#e7e0d6] bg-white p-4 text-sm text-[#746d66]">Aucune opportunité affichable.</p>;
  }
  const isLast = currentIndex === payload.opportunities.length - 1;

  return (
    <div className="mt-5 overflow-hidden rounded-3xl border border-[#d6e7e8] bg-gradient-to-br from-white to-[#f5fbfb] shadow-[0_18px_44px_rgba(47,52,55,0.08)]">
      <div className="border-b border-[#d6e7e8] bg-[#263846] px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#bce8eb]">Présentation guidée</p>
            <p className="mt-1 text-sm">Scénario {currentIndex + 1} sur {payload.opportunities.length}</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{payload.requesterLabel}</span>
        </div>
      </div>

      <div className="p-5">
        <MergeOpportunityCard opportunity={opportunity} debugMode={false} showExplanations={false} />

        <section className="mt-4 rounded-2xl border border-[#c9e7ea] bg-[#e8f8f9] p-4" aria-labelledby="why-opportunity-title">
          <h4 id="why-opportunity-title" className="font-semibold text-[#245f66]">Pourquoi cette opportunité ?</h4>
          <p className="mt-1 text-xs leading-relaxed text-[#47767b]">
            Le moteur compare les informations explicites selon une matrice de compatibilité gouvernée.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[#2f5054]">
            {opportunity.explanations.map((explanation) => <li key={explanation}>{explanation}</li>)}
          </ul>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="rounded-full border border-[#d6e7e8] bg-white px-4 py-2 text-sm font-medium text-[#2f3437] disabled:opacity-40"
          >
            Précédent
          </button>
          {!isLast ? (
            <button type="button" onClick={onNext} className="rounded-full bg-[#263846] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f4858]">
              Opportunité suivante
            </button>
          ) : (
            <button type="button" onClick={onShowTechnicalDetails} className="rounded-full bg-[#247f88] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f6c74]">
              Voir les détails techniques
            </button>
          )}
        </div>

        {isLast && showTechnicalDetails ? (
          <TechnicalDetails opportunities={payload.opportunities} />
        ) : null}
      </div>
    </div>
  );
}

function TechnicalDetails({ opportunities }: { opportunities: MergeOpportunity[] }) {
  return (
    <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
      <h4 className="font-semibold">Détails du classement</h4>
      <div className="mt-3 space-y-4">
        {opportunities.map((opportunity) => (
          <details key={opportunity.id} className="rounded-xl bg-white p-3 ring-1 ring-amber-200">
            <summary className="cursor-pointer font-medium">{opportunity.label} · {opportunity.relationalScore} %</summary>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Object.entries(opportunity.scoreBreakdown).map(([key, value]) => (
                <div key={key}><dt className="text-amber-700">{key}</dt><dd className="font-semibold">{value}</dd></div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}

function MergeOpportunityCard({
  opportunity,
  debugMode,
  showExplanations = true,
}: {
  opportunity: MergeOpportunity;
  debugMode: boolean;
  showExplanations?: boolean;
}) {
  const statusClass = opportunity.status === "EXACT_MATCH"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : opportunity.status === "NO_MATCH"
      ? "bg-slate-100 text-slate-700 ring-slate-200"
      : "bg-cyan-50 text-cyan-800 ring-cyan-200";
  return (
    <article className="rounded-2xl border border-[#e7e0d6] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-[#2f3437]">{opportunity.label}</h4>
          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass}`}>
            {opportunity.statusLabel}
          </span>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-[#263846]">{opportunity.relationalScore} %</p>
          <p className="text-[11px] uppercase tracking-wide text-[#746d66]">Score relationnel</p>
        </div>
      </div>
      {showExplanations ? (
        <ul className="mt-4 space-y-1.5 text-sm text-[#3f4548]">
          {opportunity.explanations.map((explanation) => <li key={explanation}>{explanation}</li>)}
        </ul>
      ) : null}
      {debugMode ? (
        <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <summary className="cursor-pointer font-semibold">Debug CIRO et score</summary>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(opportunity.scoreBreakdown).map(([key, value]) => (
              <div key={key}><dt className="text-amber-700">{key}</dt><dd className="font-semibold">{value}</dd></div>
            ))}
          </dl>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-[11px] text-slate-800">{JSON.stringify(opportunity.ciro, null, 2)}</pre>
        </details>
      ) : null}
    </article>
  );
}
