import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceCreationContext } from "@/lib/workspace-creation-context";
import { PageNavigationContext } from "@/components/SpatialNavigationContext";
import { objectBreadcrumb, businessLabel } from "@/lib/spatial-navigation";
import { GovernanceJourneyAssistant } from "@/app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant";
import { createGovernedJourneyAction } from "@/lib/governance-journey-actions";
import { getCurrentPrismaUser } from "@/lib/auth";
import { GovernedJourneyEducationalPreview } from "./GovernedJourneyEducationalPreview";

export const dynamic = "force-dynamic";

export default async function NewGovernedJourneyPage({ searchParams }: { searchParams?: { workspaceId?: string } }) {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const workspace = searchParams?.workspaceId !== undefined ? await getWorkspaceCreationContext(owner.id, searchParams.workspaceId) : null;
  if (searchParams?.workspaceId !== undefined && !workspace) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {workspace ? <PageNavigationContext pathname="/gouvernance/nouveau" items={objectBreadcrumb({ name: "Créer un parcours gouverné", fallback: "Créer un parcours gouverné", objectId: "", ownerId: owner.id, workspace })} /> : null}

      <div className="mt-6">
        <Link href={workspace ? `/gouvernance/workspaces/${encodeURIComponent(workspace.id)}` : "/gouvernance"} className="text-sm font-semibold text-slate-600 underline underline-offset-4">
          {workspace ? `Retour à ${businessLabel(workspace.name, "ce Workspace", [workspace.id])}` : "Retour à Mes espaces"}
        </Link>
      </div>

      <section data-boussole-id="governed-journey-builder-overview" className="mt-4 rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Creation V1</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Creer un parcours gouverne</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
          Ce formulaire cree un parcours brouillon reel et ouvre son cockpit de preparation. Aucun participant n'est contacte et aucun
          workflow n'est execute automatiquement.
        </p>
        <p data-boussole-id="governed-journey-vs-simple-link" className="mt-4 rounded-lg bg-cyan-50 p-3 text-sm leading-relaxed text-cyan-950">Utilisez un lien simple pour collecter rapidement des informations. Utilisez un parcours gouverné lorsque plusieurs acteurs, étapes ou décisions doivent être organisés et suivis dans le temps.</p>
        <p data-boussole-id="governed-journey-human-governance-notice" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">Goodissima prépare la structure. Les décisions, invitations, accès et revues restent humains.</p>
      </section>

      <GovernedJourneyEducationalPreview />

      <GovernanceJourneyAssistant key={workspace?.id ?? "generic"} initialWorkspaceId={workspace?.id} contextWorkspaceName={workspace?.name} />

      <form action={createGovernedJourneyAction} data-boussole-id="manual-governed-journey-form" className="mt-6 space-y-5 rounded-lg border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-500">Mode manuel</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Creer sans assistance</h2>
        </div>

        <label className="block text-sm font-semibold text-slate-800">
          Nom du parcours
          <input
            data-boussole-id="manual-governed-journey-title"
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
            data-boussole-id="governed-journey-need"
            required
            minLength={10}
            maxLength={2000}
            className="mt-2 min-h-32 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Decrivez le besoin a traiter"
          />
        </label>

        <div data-boussole-id="manual-governed-journey-workspace" className="rounded-lg bg-slate-50 p-4 text-sm">{workspace ? <>Création dans {businessLabel(workspace.name, "ce Workspace", [workspace.id])}<input type="hidden" name="workspaceId" value={workspace.id} /></> : "Ce parcours sera créé sans Workspace."}</div>

        <label className="block text-sm font-semibold text-slate-800">
          Participants attendus
          <textarea
            data-boussole-id="manual-governed-journey-participants"
            name="participants"
            maxLength={1000}
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Un participant attendu par ligne"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          Documents attendus
          <textarea
            data-boussole-id="manual-governed-journey-documents"
            name="documents"
            maxLength={1000}
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950"
            placeholder="Un document attendu par ligne"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button type="submit" data-boussole-id="submit-governed-journey" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
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
