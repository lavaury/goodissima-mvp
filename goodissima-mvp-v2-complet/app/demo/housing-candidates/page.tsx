export const dynamic = "force-dynamic";

import Link from "next/link";
import { HousingCandidatesDemo } from "@/components/HousingCandidatesDemo";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { housingRentalOffer, rankHousingCandidates } from "@/lib/housing-candidate-demo";

export default function HousingCandidatesDemoPage() {
  const candidates = rankHousingCandidates();
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap gap-2"><DashboardBackLink /><Link href="/opportunities" className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600">Retour aux opportunités</Link></div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Démo · Expérimental · IA-2B-DEMO-07</p>
      <h1 className="mt-2 text-3xl font-bold text-[#2f3437]">Démonstration de matching locatif certifié</h1>
      <p className="mt-2 max-w-3xl text-slate-600">Une offre fictive et vingt candidats fictifs, classés par le moteur déterministe existant. Le parcours principal de détection est visible depuis les opportunités et relations. Aucun raisonnement IA, aucune prise de contact automatique.</p>
      <div className="mt-4"><Link href="/relations" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Voir les relations et demandes</Link></div>
      <HousingCandidatesDemo offer={housingRentalOffer} candidates={candidates} />
    </main>
  );
}
