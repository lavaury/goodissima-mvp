import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { listCurrentUserGovernanceWorkspacesAction } from "@/lib/governance-workspace-actions";

const governanceActions = [
  {
    title: "Creer un parcours gouverne",
    body: "Creez un parcours brouillon reel, puis ouvrez son cockpit de preparation.",
    href: "/gouvernance/nouveau",
    cta: "Creer un parcours gouverne",
  },
  {
    title: "Consulter mes Workspaces",
    body: "Accedez aux Workspaces rattaches a vos donnees reelles.",
    href: "#espaces",
    cta: "Consulter mes Workspaces",
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

function stateTone() {
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

export default async function GovernanceWorkspacePage() {
  noStore();
  const workspaces = await listCurrentUserGovernanceWorkspacesAction();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="dashboard" organizationName="Demo Goodissima" />

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
          <Link href="/gouvernance/nouveau" className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Commencer une activite
          </Link>
        </div>

        {workspaces.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Vous n'avez pas encore de workspace.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.workspaceId}
                href={workspace.href}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-400 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="break-words text-xl font-bold text-slate-950">{workspace.name}</h3>
                    <p className="mt-1 break-words text-xs font-semibold text-slate-500">Identifiant source : {workspace.workspaceId}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${stateTone()}`}>
                    {workspace.state}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Parcours" value={workspace.journeyCount} />
                  <Metric label="Relations" value={workspace.relationCount} />
                </dl>
                <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{workspace.observation}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

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
            Cette page affiche uniquement les Workspaces rattaches a des objets persistants. Les metriques non sourcees ne sont pas evaluees.
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
