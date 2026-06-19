"use client";

import { useMemo, useState } from "react";
import { createHousingRelationRequestDraft, filterHousingCandidates, getHousingCandidateDebugDetails, type HousingCandidateFilter, type HousingRelationRequestDraft, type HousingRentalOffer, type RankedHousingCandidate } from "@/lib/housing-candidate-demo-client";

const filters: Array<{ value: HousingCandidateFilter; label: string }> = [
  { value: "ALL", label: "Tous" },
  { value: "EXCELLENT", label: "Excellents" },
  { value: "STRONG", label: "Forts" },
  { value: "OPPORTUNITY", label: "Opportunités" },
  { value: "WEAK", label: "Faibles" },
];

const bandStyle: Record<RankedHousingCandidate["band"], string> = {
  EXCELLENT: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  STRONG: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  OPPORTUNITY: "bg-amber-50 text-amber-800 ring-amber-200",
  WEAK: "bg-orange-50 text-orange-800 ring-orange-200",
  NO_MATCH: "bg-slate-100 text-slate-600 ring-slate-200",
};

const scoreLabels: Record<string, string> = {
  relationshipScore: "Relation",
  roleScore: "Rôles",
  trustScore: "Confiance",
  familyScore: "Intent",
  totalScore: "Total",
};

export function HousingCandidatesDemo({ offer, candidates }: { offer: HousingRentalOffer; candidates: RankedHousingCandidate[] }) {
  const [filter, setFilter] = useState<HousingCandidateFilter>("ALL");
  const [debugMode, setDebugMode] = useState(false);
  const [includeNoMatch, setIncludeNoMatch] = useState(false);
  const [selected, setSelected] = useState<RankedHousingCandidate | null>(null);
  const [draft, setDraft] = useState<HousingRelationRequestDraft | null>(null);
  const visible = useMemo(() => filterHousingCandidates(candidates, filter, debugMode && includeNoMatch), [candidates, debugMode, filter, includeNoMatch]);

  function confirmContact() {
    if (!selected) return;
    setDraft(createHousingRelationRequestDraft(offer, selected));
    setSelected(null);
  }

  return (
    <>
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d6e7e8] bg-white shadow-[0_20px_55px_rgba(38,56,70,0.10)]">
        <div className="bg-[#263846] px-6 py-5 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bce8eb]">Offre locative certifiée</p><h2 className="mt-2 text-2xl font-bold">{offer.title}</h2><p className="mt-1 text-sm text-slate-200">{offer.landlordDisplayName}</p></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/40">{offer.certificationStatus}</span></div></div>
        <div className="grid gap-5 p-6 lg:grid-cols-[1.2fr_0.8fr]"><div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Localisation", offer.location], ["Loyer", offer.rent], ["Surface", offer.surface], ["Configuration", offer.rooms]].map(([label, value]) => <div key={label} className="rounded-2xl bg-[#f6f0e8] p-3"><p className="text-[11px] uppercase tracking-wide text-[#746d66]">{label}</p><p className="mt-1 text-sm font-semibold text-[#2f3437]">{value}</p></div>)}</div><p className="mt-4 text-sm text-[#3f4548]"><strong>Disponibilité :</strong> {offer.availability}</p><ul className="mt-3 space-y-1.5 text-sm text-[#3f4548]">{offer.requirements.map((item) => <li key={item}>✓ {item}</li>)}</ul></div><div className="rounded-2xl border border-[#c9e7ea] bg-[#e8f8f9] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#247f88]">Preuves de confiance</p><ul className="mt-3 space-y-2 text-sm text-[#245f66]">{offer.trustCredentials.map((item) => <li key={item} className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#d6e7e8]">{item}</li>)}</ul></div></div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Classement de compatibilité gouverné</p><h2 className="mt-1 text-2xl font-bold text-[#2f3437]">Candidats locataires certifiés</h2><p className="mt-1 text-sm text-[#746d66]">{visible.length} profil(s) affiché(s) sur 20. Les hors-correspondance sont masqués par défaut.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setDebugMode((value) => !value)} className={`rounded-full px-4 py-2 text-sm font-medium ${debugMode ? "bg-amber-500 text-white" : "border bg-white text-slate-700"}`}>Mode debug</button>{debugMode ? <label className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"><input type="checkbox" checked={includeNoMatch} onChange={(event) => setIncludeNoMatch(event.target.checked)} />Afficher les hors-correspondance</label> : null}</div></div>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Filtres de classement">{filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} aria-pressed={filter === item.value} className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === item.value ? "bg-[#263846] text-white" : "border border-[#d6e7e8] bg-white text-[#3f4548] hover:bg-[#e8f8f9]"}`}>{item.label}</button>)}</div>

        {draft ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><p className="font-semibold">Demande de mise en relation préparée</p><p className="mt-1 text-sm">Brouillon local pour {draft.targetCandidate} · score {draft.matchScore} % · statut {draft.status}. Aucun message n'a été envoyé.</p></div> : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-2">{visible.map((candidate, index) => <CandidateCard key={candidate.id} candidate={candidate} rank={index + 1} debugMode={debugMode} onContact={() => setSelected(candidate)} />)}</div>
        {visible.length === 0 ? <p className="mt-5 rounded-2xl border bg-white p-5 text-sm text-slate-500">Aucun candidat dans ce filtre.</p> : null}
      </section>

      {selected ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="housing-contact-title"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Brouillon relationnel</p><h2 id="housing-contact-title" className="mt-2 text-xl font-bold">Souhaitez-vous demander une mise en relation avec ce candidat ?</h2><p className="mt-3 text-sm text-slate-600">{selected.displayName} · {selected.matchScore} % · {selected.bandLabel}</p><p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Cette démonstration prépare uniquement un brouillon. Aucun message, e-mail ou contact externe ne sera créé.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border px-4 py-2 text-sm font-medium">Annuler</button><button type="button" onClick={confirmContact} className="rounded-xl bg-[#247f88] px-4 py-2 text-sm font-medium text-white">Préparer la demande</button></div></div></div> : null}
    </>
  );
}

function CandidateCard({ candidate, rank, debugMode, onContact }: { candidate: RankedHousingCandidate; rank: number; debugMode: boolean; onContact: () => void }) {
  const debug = getHousingCandidateDebugDetails(candidate, debugMode);
  const contactable = candidate.band === "EXCELLENT" || candidate.band === "STRONG";
  return (
    <article className="rounded-3xl border border-[#e7e0d6] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#263846] text-sm font-bold text-white">{rank}</span><div><h3 className="font-bold text-[#2f3437]">{candidate.displayName}</h3><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">{candidate.certificationStatus}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${bandStyle[candidate.band]}`}>{candidate.bandLabel}</span></div></div></div><div className="text-right"><p className="text-2xl font-bold text-[#263846]">{candidate.matchScore} %</p><p className="text-[10px] uppercase tracking-wide text-[#746d66]">Score de match</p></div></div>
      <p className="mt-4 text-sm leading-relaxed text-[#3f4548]">{candidate.summary}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#e8f8f9] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#247f88]">Explications</p><ul className="mt-2 space-y-1 text-sm text-[#2f5054]">{candidate.explanations.map((item) => <li key={item}>✓ {item}</li>)}</ul></div><div className="rounded-2xl bg-[#f6f0e8] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#746d66]">Points à vérifier</p>{candidate.weakCriteria.length ? <ul className="mt-2 space-y-1 text-sm text-[#5f5750]">{candidate.weakCriteria.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-[#5f5750]">Aucun point faible identifié.</p>}</div></div>
      <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Justificatifs certifiés</p><div className="mt-2 flex flex-wrap gap-2">{candidate.trustCredentials.map((item) => <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{item}</span>)}</div></div>
      {contactable ? <button type="button" onClick={onContact} className="mt-5 rounded-full bg-[#247f88] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f6c74]">Demander la mise en relation</button> : null}
      {debug ? <details className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><summary className="cursor-pointer font-semibold">Détails CIRO et décomposition du score</summary><dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(debug.scoreBreakdown).map(([key, value]) => <div key={key}><dt className="text-amber-700">{scoreLabels[key] ?? key}</dt><dd className="font-bold">{value}</dd></div>)}</dl><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-[11px] text-slate-800">{JSON.stringify(debug.ciro, null, 2)}</pre></details> : null}
    </article>
  );
}
