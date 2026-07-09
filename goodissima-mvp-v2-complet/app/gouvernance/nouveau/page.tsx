import Link from "next/link";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { GovernanceJourneyAssistant } from "@/app/gouvernance/nouveau/GovernanceJourneyAssistant";
import { createGovernedJourneyAction } from "@/lib/governance-journey-actions";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  getGovernanceWorkspaceOptions,
  workspaceCategoryLabels,
  type GovernanceWorkspaceOption,
} from "@/lib/governance-workspace-repository";

export const dynamic = "force-dynamic";

const categoryOptions = ["PROFESSIONAL", "PRIVATE", "FAMILY", "ASSOCIATION", "PROJECT", "CLIENT", "OTHER"] as const;

function WorkspaceFields({ workspaces }: { workspaces: GovernanceWorkspaceOption[] }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-950">Workspace persistant</p>
      <p className="mt-1 text-xs text-slate-500">
        Choisissez un Workspace existant, ou saisissez un nouveau nom si aucun ne convient.
      </p>
      <div className="mt-3 grid gap-3">
        <label className="block text-xs font-semibold text-slate-700">
          Workspace existant
          <select
            name="workspaceId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
          >
            <option value="">Creer ou reutiliser par nouveau nom</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name} - {workspace.categoryLabel} - {workspace.kindLabel}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Nouveau nom de Workspace
          <input
            name="workspaceName"
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Utilise si aucun Workspace existant n'est choisi"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Rubrique du nouveau Workspace
          <select
            name="workspaceCategory"
            defaultValue="OTHER"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950"
          >
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {workspaceCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export default async function NewGovernedJourneyPage() {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const workspaces = await getGovernanceWorkspaceOptions(owner.id);

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

      <GovernanceJourneyAssistant workspaces={workspaces} />

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

        <WorkspaceFields workspaces={workspaces} />

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
