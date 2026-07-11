export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChampagneScenariosPanel } from "@/components/ChampagneScenariosPanel";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { canAccessChampagneWorkspace } from "@/lib/champagne-workspace";
import { canAccessFeedbackAdmin } from "@/lib/product-feedback";
import { isDemoSurfaceEnabled } from "@/lib/debug";

export default async function AdministrationPage() {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const showChampagneScenarios = canAccessChampagneWorkspace(owner.role);
  const showFeedbackAdmin = canAccessFeedbackAdmin(owner.role);
  const showDemoSurfaces = isDemoSurfaceEnabled();

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <DashboardBackLink className="mb-4" />
    <PlatformNavigation active="admin" organizationName={organizationName} />
    <section className="rounded-3xl border bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Administration</p>
      <h1 className="mt-2 text-3xl font-bold">Administration Goodissima</h1>
      <p className="mt-2 max-w-3xl text-slate-600">Accès aux tableaux de bord et routes d'administration. Les démonstrations restent disponibles, mais ne constituent pas le parcours utilisateur principal.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href="/ia-valeur" className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <span className="rounded-full bg-violet-700 px-3 py-1 text-xs font-semibold text-white">Admin</span>
          <h2 className="mt-3 font-semibold text-violet-950">IA & Valeur</h2>
          <p className="mt-1 text-sm text-violet-800">Coûts IA, valeur estimée, ROI et exports CSV.</p>
        </Link>
        {showFeedbackAdmin ? (
          <Link href="/administration/feedback" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">Admin produit</span>
            <h2 className="mt-3 font-semibold text-emerald-950">Feedback produit</h2>
            <p className="mt-1 text-sm text-emerald-800">Revue des retours, suivi de statut, notes internes et export CSV.</p>
          </Link>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5" aria-disabled="true">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Accès réservé</span>
            <h2 className="mt-3 font-semibold text-slate-800">Feedback produit</h2>
            <p className="mt-1 text-sm text-slate-600">
              La revue des retours est réservée aux rôles Admin produit, Admin et Super Admin.
            </p>
          </section>
        )}
        {showDemoSurfaces ? <><Link href="/templates/demo" className="rounded-2xl border bg-white p-5">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Démo · Expérimental</span>
          <h2 className="mt-3 font-semibold">Démo parcours IA</h2>
          <p className="mt-1 text-sm text-slate-500">Flux guidé de démonstration pour validation produit.</p>
        </Link>
        <Link href="/demo/housing-candidates" className="rounded-2xl border bg-white p-5">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Démo · Expérimental</span>
          <h2 className="mt-3 font-semibold">Démo candidats détectés</h2>
          <p className="mt-1 text-sm text-slate-500">Classement de candidats fictifs par le moteur existant.</p>
        </Link></> : null}
        <Link href="/admin/ai-costs" className="rounded-2xl border bg-white p-5">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Route admin historique</span>
          <h2 className="mt-3 font-semibold">Observabilité IA</h2>
          <p className="mt-1 text-sm text-slate-500">URL conservée pour compatibilité.</p>
        </Link>
      </div>
    </section>
    {showChampagneScenarios ? <div id="tests-champagne" className="mt-8"><ChampagneScenariosPanel /></div> : null}
  </main>;
}
