export const dynamic = "force-dynamic";

import Link from "next/link";
import { AITemplateDesigner } from "@/components/AITemplateDesigner";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";

export default async function NewOpportunityPage() {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <DashboardBackLink className="mb-4" />
    <PlatformNavigation active="opportunities" organizationName={organizationName} />
    <section id="creation-options" className="scroll-mt-6 rounded-3xl border border-cyan-200 bg-cyan-50 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">Créer une opportunité</p>
      <h1 className="mt-2 text-3xl font-bold text-cyan-950">Choisir le mode de création</h1>
      <p className="mt-2 max-w-3xl text-cyan-900">Décrivez le besoin au clavier ou à la voix, ou partez d'un parcours déjà publié pour créer manuellement une annonce. Rien n'est publié, validé ou envoyé automatiquement.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <a href="#ai-assisted" className="rounded-2xl bg-white p-5 ring-1 ring-cyan-200">
          <span className="rounded-full bg-violet-700 px-3 py-1 text-xs font-semibold text-white">Assisté par IA</span>
          <h2 className="mt-3 font-semibold text-cyan-950">Structurer avec l'IA et la voix</h2>
          <p className="mt-1 text-sm text-cyan-900">Créer une proposition de parcours et d'annonce en brouillon, puis relire et valider humainement.</p>
        </a>
        <Link href="/links/new" className="rounded-2xl bg-white p-5 ring-1 ring-cyan-200">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Manuel</span>
          <h2 className="mt-3 font-semibold text-cyan-950">Créer depuis un parcours publié</h2>
          <p className="mt-1 text-sm text-cyan-900">Créer un lien sécurisé dans le contexte d'une annonce prête à être partagée.</p>
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/opportunities" className="rounded-xl border border-cyan-300 bg-white px-4 py-2 text-sm font-semibold text-cyan-900">Voir mes opportunités</Link>
      </div>
    </section>
    <div id="ai-assisted" className="scroll-mt-6"><AITemplateDesigner /></div>
  </main>;
}
