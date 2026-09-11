export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentPrismaUser } from "@/lib/auth";
import { OpportunityDraftCreator } from "@/components/OpportunityDraftCreator";

export default async function NewOpportunityPage() {
  await getCurrentPrismaUser();
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
    <nav aria-label="Fil d’Ariane" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-600"><Link href="/opportunities" className="rounded-lg px-2 py-1 font-semibold hover:bg-slate-100">← Retour</Link><span aria-hidden="true">›</span><Link href="/" className="hover:underline">Accueil</Link><span aria-hidden="true">›</span><span aria-current="page">Créer une opportunité</span></nav>
    <OpportunityDraftCreator />
    <p className="mt-6 text-center text-sm"><Link href="/gouvernance" className="font-semibold text-cyan-800 underline">Voir dans Mes espaces</Link></p>
  </main>;
}
