import Link from "next/link";
import { Suspense } from "react";
import { GovernedMemoryPage } from "@/components/governed-memory/GovernedMemoryPage";

export const dynamic = "force-dynamic";

export default function RelationCaseMemoryPage({ params }: { params: { caseId: string } }) {
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Link href={`/cases/${encodeURIComponent(params.caseId)}`} className="inline-flex rounded-lg text-sm font-semibold text-[#247f88] underline focus:outline-none focus:ring-2 focus:ring-cyan-500">Retour au dossier</Link><header className="mt-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Dossier relationnel</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Mémoire gouvernée</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Consultez les faits, décisions, sources visibles, événements et droits reconstruits dans le temps. Cette surface est strictement en lecture seule.</p></header><div className="mt-7"><Suspense fallback={<div className="rounded-2xl border bg-white p-6" aria-live="polite">Chargement de la consultation…</div>}><GovernedMemoryPage relationCaseId={params.caseId} /></Suspense></div></main>;
}
