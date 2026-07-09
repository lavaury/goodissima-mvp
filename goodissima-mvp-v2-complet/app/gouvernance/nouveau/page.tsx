import Link from "next/link";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { GovernanceJourneyAssistant } from "@/app/gouvernance/nouveau/GovernanceJourneyAssistant";
import { createGovernedJourneyAction } from "@/lib/governance-journey-actions";
import { getCurrentPrismaUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewGovernedJourneyPage() {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="new-governance" organizationName={organizationName} />

      <div className="mt-6">
        <Link href="/gouvernance" className="text-sm font-semibold text-slate-600 underline underline-offset-4">
          Retour a la gouvernance
        </Link>
      </div>

      <section className="mt-4 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Creation V1</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Creer un parcours gouverne</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
          Ce formulaire cree un parcours brouillon reel et ouvre son cockpit de preparation. Aucun participant n'est contacte et aucun
          workflow n'est execute automatiquement.
        </p>
      </section>

      <GovernanceJourneyAssistant />

      <form action={createGovernedJourneyAction} className="mt-6 space-y-5 rounded-lg border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-500">Mode manuel</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Creer sans assistance</h2>
        </div>

        <label className="block text-sm font-semibold text-slate-800">
          Nom du parcours
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Nom saisi par l'utilisateur"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Besoin initial
          <textarea
            name="initialNeed"
            required
            minLength={10}
            maxLength={2000}
            className="mt-2 min-h-32 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Decrivez le besoin a traiter"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Workspace cible
          <input
            name="workspaceId"
            maxLength={120}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Identifiant optionnel conserve en metadata V1"
          />
          <span className="mt-2 block text-xs font-normal text-slate-500">
            Le schema V1 ne rattache pas encore les parcours a un objet Workspace. Cette valeur est conservee comme metadata de creation.
          </span>
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Participants attendus
          <textarea
            name="participants"
            maxLength={1000}
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Un participant attendu par ligne"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Documents attendus
          <textarea
            name="documents"
            maxLength={1000}
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Un document attendu par ligne"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Creer le parcours gouverne
          </button>
          <Link href="/gouvernance" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
