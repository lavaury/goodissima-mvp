import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  attachGLinkToWorkspaceAction,
  attachGovernedJourneyToWorkspaceAction,
  attachRelationCaseToWorkspaceAction,
} from "@/lib/governance-workspace-actions";
import {
  getGovernanceWorkspaceOptions,
  getRealGovernanceWorkspaceSummaries,
  getUnassignedGLinkSummaries,
  getUnassignedGovernedJourneySummaries,
  getUnassignedRelationCaseSummaries,
} from "@/lib/governance-workspace-repository";
import { getGovernancePortfolioSummaries } from "@/lib/governance-portfolio-repository";

const governanceActions = [
  {
    title: "Salle de pilotage",
    boussoleId: "open-global-governance-pilotage",
    body: "Voir les actions humaines à traiter : accès invités, réunions préparées, participants à autoriser, communications récentes.",
    href: "/gouvernance/pilotage",
    cta: "Ouvrir la salle de pilotage",
  },
  {
    title: "Creer un parcours gouverne",
    boussoleId: "create-governed-journey",
    body: "Creez un parcours brouillon reel, puis ouvrez son cockpit de preparation.",
    href: "/gouvernance/nouveau",
    cta: "Creer un parcours gouverne",
  },
  {
    title: "Annuaire Goodissima V1",
    boussoleId: "open-directory",
    body: "Consultez l'espace transversal d'identite, de confiance et de preparation des contacts.",
    href: "/annuaire",
    cta: "Consulter l'annuaire Goodissima V1",
  },
  {
    title: "Creer un Workspace",
    boussoleId: "create-workspace",
    body: "Preparez un espace produit nomme et classe avant d'y rattacher des parcours.",
    href: "/gouvernance/workspaces/nouveau",
    cta: "Creer un Workspace",
  },
  {
    title: "Creer un Portfolio",
    boussoleId: "create-portfolio",
    body: "Regroupez plusieurs Workspaces dans un portefeuille produit sans creer de dossier ni lancer d'action.",
    href: "/gouvernance/portfolios/nouveau",
    cta: "Creer un Portfolio",
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
  const [portfolios, workspaces, workspaceOptions, unassignedJourneys, unassignedRelationCases, unassignedGLinks] = await Promise.all([
    getGovernancePortfolioSummaries(owner.id),
    getRealGovernanceWorkspaceSummaries(owner.id),
    getGovernanceWorkspaceOptions(owner.id),
    getUnassignedGovernedJourneySummaries(owner.id),
    getUnassignedRelationCaseSummaries(owner.id),
    getUnassignedGLinkSummaries(owner.id),
  ]);
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const firstGovernedJourneyId = workspaces.flatMap((workspace) => workspace.journeys).at(0)?.relationTemplateId;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="governance" organizationName={organizationName} />

      <section data-boussole-id="governance-overview" className="rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#247f88]">Accueil de la Gouvernance</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Gouvernance</h1>
        <p className="mt-2 max-w-4xl text-base text-slate-700">
          La Gouvernance est votre espace de pilotage. Elle vous permet de creer, organiser et suivre vos parcours de confiance dans chacun
          de vos Workspaces.
        </p>
        <div data-boussole-id="governance-simple-link-difference" className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm leading-relaxed text-cyan-950">
          Utilisez un lien simple pour collecter rapidement des informations. Utilisez un parcours gouverné lorsque plusieurs acteurs, responsabilités, invitations, revues ou un pilotage structuré sont nécessaires. Le parcours gouverné se crée ici, dans Gouvernance.
        </div>
        <p data-boussole-id="governance-human-control-notice" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
          Goodissima prépare et organise les actions. Les décisions, invitations et revues restent humaines et ne sont jamais conduites automatiquement.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {governanceActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              data-boussole-id={action.boussoleId === "create-portfolio" ? "create-portfolio-card" : action.boussoleId === "open-directory" ? "governance-directory-card" : action.boussoleId}
              className="flex min-h-44 flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-400 hover:bg-white"
            >
              <h2 className="text-lg font-bold text-slate-950">{action.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{action.body}</p>
              <span data-boussole-id={action.boussoleId === "create-portfolio" ? "create-portfolio" : action.boussoleId === "open-directory" ? "open-goodissima-directory" : undefined} className="mt-auto pt-5 text-sm font-bold text-[#247f88]">{action.cta}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p data-boussole-id="governance-create-human-validation" className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">Toute proposition de parcours doit être examinée et validée humainement avant sa création. Aucun parcours n’est envoyé ou partagé automatiquement.</p>
          <p data-boussole-id="governance-pilotage-explanation" className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">La Salle de pilotage globale rassemble les signaux transversaux. Le cockpit d’un parcours concerne uniquement ce parcours gouverné.</p>
        </div>
      </section>

      <section data-boussole-id="governance-workspace-portfolio-explanation" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Portfolios</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Regrouper mes Workspaces</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-700">
              Portfolio : regroupe plusieurs Workspaces. Workspace : organise les parcours, liens, dossiers et communications.
            </p>
          </div>
          <Link href="/gouvernance/portfolios/nouveau" data-boussole-id="create-portfolio" className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Creer un Portfolio
          </Link>
        </div>

        {portfolios.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Vous pouvez creer un Portfolio pour regrouper plusieurs Workspaces. Aucun Portfolio n'est cree automatiquement.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {portfolios.map((portfolio) => (
              <article key={portfolio.id} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="break-words text-xl font-bold text-slate-950">{portfolio.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Type : {portfolio.kindLabel}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${stateTone(portfolio.statusLabel)}`}>
                    {portfolio.statusLabel}
                  </span>
                </div>
                {portfolio.description ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{portfolio.description}</p>
                ) : null}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Workspaces" value={portfolio.workspaceCount} />
                  <Metric label="Objets" value={portfolio.totalObjectCount} />
                  <Metric label="Dossiers" value={portfolio.relationCaseCount} />
                  <Metric label="Communications" value={portfolio.communicationSessionCount} />
                </dl>
                <Link href={`/gouvernance/portfolios/${portfolio.id}`} data-boussole-id="open-portfolio" className="mt-4 inline-block rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Ouvrir
                </Link>
              </article>
            ))}
          </div>
        )}

        <p data-boussole-id="portfolio-v1-limit" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          V1 : le Portfolio regroupe les Workspaces. La salle de pilotage, les signaux d'intervention et l'IA assistive
          seront ajoutes dans des sprints dedies.
        </p>
      </section>

      <section id="espaces" data-boussole-id="workspace-list" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Workspaces</p>
            <h2 data-boussole-id="governance-workspaces-section" className="mt-1 text-2xl font-bold text-slate-950">Consulter mes Workspaces</h2>
            <p data-boussole-id="governance-workspaces-count" className="mt-2 text-sm font-semibold text-slate-600">{workspaces.length} Workspace{workspaces.length > 1 ? "s" : ""} visible{workspaces.length > 1 ? "s" : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/gouvernance/workspaces/nouveau" data-boussole-id="create-workspace" className="w-fit rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
              Creer un Workspace
            </Link>
            <Link href="/gouvernance/nouveau" data-boussole-id="create-governed-journey" className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Creer un parcours gouverne
            </Link>
          </div>
        </div>

        {workspaces.length === 0 ? (
          <p data-boussole-id="governance-empty-state" className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Vous n'avez pas encore de workspace.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <article
                key={workspace.workspaceId}
                data-boussole-id={workspace.workspaceId === workspaces[0]?.workspaceId ? "governance-first-workspace" : undefined}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="break-words text-xl font-bold text-slate-950">{workspace.name}</h3>
                    <p className="mt-1 break-words text-xs font-semibold text-slate-500">Slug : {workspace.slug}</p>
                    <div data-boussole-id={workspace.workspaceId === workspaces[0]?.workspaceId ? "workspace-category" : undefined} className="mt-3 flex flex-wrap gap-2">
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

                <dl data-boussole-id={workspace.workspaceId === workspaces[0]?.workspaceId ? "workspace-object-counts" : undefined} className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">
                  <Metric label="Parcours" value={workspace.journeyCount} />
                  <Metric label="Relations" value={workspace.relationCount} />
                  <Metric label="Liens" value={workspace.linkCount} />
                  <Metric label="Communications" value={workspace.communicationCount} />
                  <Metric label="Objets" value={workspace.totalObjects} />
                </dl>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Metric label="Preparees" value={workspace.preparedCommunicationCount} />
                  <Metric label="Terminees" value={workspace.completedCommunicationCount} />
                  <Metric label="Expirees" value={workspace.expiredCommunicationCount} />
                </dl>
                <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{workspace.observation}</p>

                {workspace.journeys.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parcours gouvernes</p>
                    {workspace.journeys.map((journey) => (
                      <div key={journey.relationTemplateId} data-boussole-id={journey.relationTemplateId === firstGovernedJourneyId ? "governance-first-journey" : undefined} className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div><p data-boussole-id={journey.relationTemplateId === firstGovernedJourneyId ? "governed-journey-title" : undefined} className="text-sm font-semibold text-slate-800">{journey.name}</p><p data-boussole-id={journey.relationTemplateId === firstGovernedJourneyId ? "governed-journey-workspace" : undefined} className="mt-1 text-xs text-slate-500">Workspace : {workspace.name}</p></div>
                        {journey.href ? (
                          <Link href={journey.href} data-boussole-id={journey.relationTemplateId === firstGovernedJourneyId ? "open-governed-journey" : undefined} className="w-fit rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700">
                            Ouvrir le cockpit
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">Cockpit indisponible</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                {workspace.relationCases.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dossiers relationnels</p>
                    {workspace.relationCases.map((relationCase) => (
                      <div key={relationCase.id} className="rounded-lg bg-white px-3 py-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {relationCase.candidateName || relationCase.candidateEmail}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {relationCase.gLinkTitle} - {relationCase.status} - {formatDate(relationCase.createdAt)}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Communications relationnelles : {relationCase.communicationsCount}
                            </p>
                          </div>
                          <Link href={relationCase.href} className="w-fit rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700">
                            Ouvrir le dossier
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {workspace.gLinks.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Liens relationnels</p>
                    {workspace.gLinks.map((link) => (
                      <div key={link.id} className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{link.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            /l/{link.slug} - {link.status} - {link.relationCaseCount} dossier{link.relationCaseCount > 1 ? "s" : ""}
                          </p>
                        </div>
                        <Link href={link.href} className="w-fit rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700">
                          Ouvrir le lien
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : null}

                {workspace.relationCommunicationCount > 0 ? (
                  <p className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                    Communications rattachees aux dossiers relationnels : {workspace.relationCommunicationCount}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {unassignedJourneys.length > 0 ? (
        <section data-boussole-id="governed-journeys-without-workspace" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">Rattachement manuel</p>
              <h2 className="mt-1 text-2xl font-bold text-amber-950">Parcours gouvernes sans Workspace</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-900">
                Ces parcours existent deja et peuvent etre rattaches a un Workspace produit actif. Aucun Workspace,
                invitation, acces ou workflow n'est cree automatiquement.
              </p>
            </div>
            <Link href="/gouvernance/workspaces/nouveau" data-boussole-id="create-workspace-from-unassigned-journeys" className="w-fit rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950">
              Creer un Workspace
            </Link>
          </div>

          {workspaceOptions.length === 0 ? (
            <p data-boussole-id="no-workspace-available-for-attachment" className="mt-5 rounded-lg bg-white px-4 py-3 text-sm text-amber-900">
              Aucun Workspace actif disponible pour le rattachement.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {unassignedJourneys.map((journey, index) => (
                <article key={journey.formTemplateId} data-boussole-id={index === 0 ? "first-unassigned-governed-journey" : undefined} className="rounded-lg border border-amber-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 data-boussole-id={index === 0 ? "unassigned-journey-title" : undefined} className="font-bold text-slate-950">{journey.title}</h3>
                      <p data-boussole-id={index === 0 ? "unassigned-journey-created-at" : undefined} className="mt-1 text-xs font-semibold text-slate-500">Cree le {formatDate(journey.createdAt)}</p>
                      <Link href={journey.href} data-boussole-id={index === 0 ? "open-unassigned-journey-cockpit" : undefined} className="mt-2 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                        Ouvrir le cockpit
                      </Link>
                    </div>
                    <form action={attachGovernedJourneyToWorkspaceAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input type="hidden" name="formTemplateId" value={journey.formTemplateId} />
                      <select
                        name="workspaceId"
                        data-boussole-id={index === 0 ? "select-workspace-for-journey" : undefined}
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
                      <button type="submit" data-boussole-id={index === 0 ? "attach-journey-to-workspace" : undefined} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        Rattacher au Workspace
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : <p data-boussole-id="no-unassigned-governed-journeys" className="mt-6 rounded-lg border border-dashed bg-white p-5 text-sm text-slate-600">Tous les parcours gouvernés visibles sont déjà organisés dans un Workspace.</p>}

      <section data-boussole-id="relational-cases-workspace-attachment" className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Dossiers relationnels</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Rattachement aux Workspaces</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-700">
              Le rattachement au Workspace organise les dossiers et liens existants. Il ne modifie pas les acces candidats,
              n'envoie aucune notification et ne cree aucun nouveau lien.
            </p>
          </div>
          <Link href="/gouvernance/workspaces/nouveau" className="w-fit rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
            Creer un Workspace
          </Link>
        </div>

        {unassignedRelationCases.length === 0 ? (
          <p data-boussole-id="no-unassigned-relational-cases" className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Aucun dossier relationnel sans Workspace.
          </p>
        ) : (
          <div data-boussole-id="relational-cases-without-workspace" className="mt-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Dossiers sans Workspace</h3>
            {unassignedRelationCases.map((relationCase, index) => (
              <article key={relationCase.id} data-boussole-id={index === 0 ? "first-unassigned-relational-case" : undefined} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-950">{relationCase.candidateName || relationCase.candidateEmail}</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {relationCase.gLinkTitle} - {relationCase.status} - cree le {formatDate(relationCase.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Communications relationnelles : {relationCase.communicationsCount}
                    </p>
                    <Link href={relationCase.href} className="mt-2 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                      Ouvrir le dossier
                    </Link>
                  </div>
                  {workspaceOptions.length > 0 ? (
                    <form action={attachRelationCaseToWorkspaceAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input type="hidden" name="relationCaseId" value={relationCase.id} />
                      <select
                        name="workspaceId"
                        data-boussole-id={index === 0 ? "select-workspace-for-relational-case" : undefined}
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
                      <button type="submit" data-boussole-id={index === 0 ? "attach-relational-case-to-workspace" : undefined} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        Rattacher au Workspace
                      </button>
                    </form>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Aucun Workspace actif disponible.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {unassignedGLinks.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Aucun lien relationnel sans Workspace.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Liens relationnels sans Workspace</h3>
            {unassignedGLinks.map((link) => (
              <article key={link.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="font-bold text-slate-950">{link.title}</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      /l/{link.slug} - {link.status} - cree le {formatDate(link.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Dossiers lies : {link.relationCaseCount}. Dossiers lies sans Workspace : {link.unassignedRelationCaseCount}.
                    </p>
                    <Link href={link.href} className="mt-2 inline-block text-xs font-bold text-[#247f88] underline underline-offset-4">
                      Ouvrir le lien
                    </Link>
                  </div>
                  {workspaceOptions.length > 0 ? (
                    <form action={attachGLinkToWorkspaceAction} className="flex flex-col gap-2 lg:items-end">
                      <input type="hidden" name="gLinkId" value={link.id} />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                      </div>
                      {link.unassignedRelationCaseCount > 0 ? (
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input type="checkbox" name="attachUnassignedCases" className="h-4 w-4" />
                          Rattacher aussi les dossiers de ce lien encore sans Workspace
                        </label>
                      ) : null}
                    </form>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Aucun Workspace actif disponible.</p>
                  )}
                </div>
              </article>
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
