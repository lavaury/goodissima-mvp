import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { attachGovernedJourneyToWorkspaceAction } from "@/lib/governance-workspace-actions";
import {
  getGovernanceWorkspaceOptions,
  getRealGovernanceWorkspaceSummaries,
  getUnassignedGovernedJourneySummaries,
} from "@/lib/governance-workspace-repository";

const governanceActions = [
  {
    title: "Creer un parcours gouverne",
    body: "Creez un parcours brouillon reel, puis ouvrez son cockpit de preparation.",
    href: "/gouvernance/nouveau",
    cta: "Creer un parcours gouverne",
  },
  {
    title: "Annuaire Goodissima V1",
    body: "Consultez l'espace transversal d'identite, de confiance et de preparation des contacts.",
    href: "/annuaire",
    cta: "Consulter l'annuaire Goodissima V1",
  },
  {
    title: "Creer un Workspace",
    body: "Preparez un espace produit nomme et classe avant d'y rattacher des parcours.",
    href: "/gouvernance/workspaces/nouveau",
    cta: "Creer un Workspace",
  },
];

const lifecycle = [
  "Nouvelle activite",
  "Expression du besoin",
  "Preparation du parcours par l'IA",
  "Validation humaine",
  "Choix du Workspace",
  "Creation du parcours",
  "Invitation des participants",
  "Creation des Relations",
  "Salle de Pilotage du parcours",
  "Vie du parcours",
  "Portfolio du Workspace",
];

function stateTone(state: string) {
  return state === "Actif" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-50 text-slate-700 ring-slate-200";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default async function GovernanceWorkspacePage() {
  noStore();
  const owner = await getCurrentPrismaUser();
  const [workspaces, workspaceOptions, unassignedJourneys] = await Promise.all([
    getRealGovernanceWorkspaceSummaries(owner.id),
    getGovernanceWorkspaceOptions(owner.id),
    getUnassignedGovernedJourneySummaries(owner.id),
  ]);
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="governance" organizationName={organizationName} />

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Accueil de la Gouvernance</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Gouvernance</h1>
        <p className="mt-2 max-w-4xl text-base text-slate-700">
          La Gouvernance est votre espace de pilotage. Elle vous permet de creer, organiser et suivre vos parcours de confiance dans chacun
          de vos Workspaces.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {governanceActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="flex min-h-44 flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-400 hover:bg-white"
            >
              <h2 className="text-lg font-bold text-slate-950">{action.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{action.body}</p>
              <span className="mt-auto pt-5 text-sm font-bold text-[#247f88]">{action.cta}</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="espaces" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Workspaces</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Consulter mes Workspaces</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/gouvernance/workspaces/nouveau" className="w-fit rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
              Creer un Workspace
            </Link>
            <Link href="/gouvernance/nouveau" className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Commencer une activite
            </Link>
          </div>
        </div>

        {workspaces.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Vous n'avez pas encore de workspace.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <article
                key={workspace.workspaceId}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="break-words text-xl font-bold text-slate-950">{workspace.name}</h3>
                    <p className="mt-1 break-words text-xs font-semibold text-slate-500">Slug : {workspace.slug}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                        Rubrique : {workspace.categoryLabel}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                        Type : {workspace.kindLabel}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${stateTone(workspace.state)}`}>
                    {workspace.state}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                  <Metric label="Parcours" value={workspace.journeyCount} />
                  <Metric label="Relations" value={workspace.relationCount} />
                  <Metric label="Liens" value={workspace.linkCount} />
                  <Metric label="Objets" value={workspace.totalObjects} />
                </dl>
                <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{workspace.observation}</p>

                {workspace.journeys.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parcours gouvernes</p>
                    {workspace.journeys.map((journey) => (
                      <div key={journey.relationTemplateId} className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-800">{journey.name}</p>
                        {journey.href ? (
                          <Link href={journey.href} className="w-fit rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700">
                            Ouvrir le cockpit
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">Cockpit indisponible</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {unassignedJourneys.length > 0 ? (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">Rattachement manuel</p>
              <h2 className="mt-1 text-2xl font-bold text-amber-950">Parcours gouvernes sans Workspace</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-900">
                Ces parcours existent deja et peuvent etre rattaches a un Workspace produit actif. Aucun Workspace,
                invitation, acces ou workflow n'est cree automatiquement.
              </p>
            </div>
            <Link href="/gouvernance/workspaces/nouveau" className="w-fit rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950">
              Creer un Workspace
            </Link>
          </div>

          {workspaceOptions.length === 0 ? (
            <p className="mt-5 rounded-lg bg-white px-4 py-3 text-sm text-amber-900">
              Aucun Workspace actif disponible pour le rattachement.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {unassignedJourneys.map((journey) => (
                <article key={journey.formTemplateId} className="rounded-lg border border-amber-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-950">{journey.title}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Cree le {formatDate(journey.createdAt)}</p>
                      <Link href={journey.href} className="mt-2 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                        Ouvrir le cockpit
                      </Link>
                    </div>
                    <form action={attachGovernedJourneyToWorkspaceAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input type="hidden" name="formTemplateId" value={journey.formTemplateId} />
                      <select
                        name="workspaceId"
                        required
                        className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
                      >
                        <option value="">Choisir un Workspace</option>
                        {workspaceOptions.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.name} - {workspace.categoryLabel} - {workspace.kindLabel}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        Rattacher au Workspace
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Pourquoi creer un espace ?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Un espace de gouvernance permet de separer les differents univers de travail. Chaque espace possede sa propre memoire, son
            propre portfolio, sa propre salle de pilotage, ses parcours et son assistance IA.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Affichage V1</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            V1 : le Workspace est maintenant persistant. Les permissions avancees, membres, communications et medias seront ajoutes dans des sprints dedies.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Cycle de vie d'une activite</h2>
        <ol className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {lifecycle.map((step, index) => (
            <li key={step} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
              <span className="mr-2 text-[#247f88]">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold text-slate-950">{value}</dd>
    </div>
  );
}
