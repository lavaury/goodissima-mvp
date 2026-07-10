import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  attachWorkspaceToPortfolioAction,
  detachWorkspaceFromPortfolioAction,
} from "@/lib/governance-portfolio-actions";
import {
  getAvailableWorkspacesForPortfolio,
  getGovernancePortfolioDetail,
} from "@/lib/governance-portfolio-repository";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-slate-950">{value}</dd>
    </div>
  );
}

export default async function GovernancePortfolioDetailPage({ params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const [portfolio, availableWorkspaces] = await Promise.all([
    getGovernancePortfolioDetail({ ownerId: owner.id, portfolioId: params.id }),
    getAvailableWorkspacesForPortfolio(owner.id),
  ]);

  if (!portfolio) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PlatformNavigation active="governance" organizationName={organizationName} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/gouvernance" className="text-sm font-semibold text-slate-600 underline underline-offset-4">
          Retour a la gouvernance
        </Link>
        <Link href="/gouvernance/portfolios/nouveau" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
          Creer un Portfolio
        </Link>
      </div>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#247f88]">Portfolio produit</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">{portfolio.name}</h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">Slug : {portfolio.slug}</p>
            {portfolio.description ? (
              <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-700">{portfolio.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Type : {portfolio.kindLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Statut : {portfolio.statusLabel}
            </span>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-5">
          <Metric label="Workspaces" value={portfolio.workspaceCount} />
          <Metric label="Parcours" value={portfolio.journeyCount} />
          <Metric label="Liens" value={portfolio.gLinkCount} />
          <Metric label="Dossiers" value={portfolio.relationCaseCount} />
          <Metric label="Communications" value={portfolio.communicationSessionCount} />
        </dl>

        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          V1 : le Portfolio regroupe les Workspaces. La salle de pilotage, les signaux d'intervention et l'IA assistive
          seront ajoutes dans des sprints dedies.
        </p>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Workspaces rattaches</h2>
        {portfolio.workspaces.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-5 text-sm text-slate-600">
            Aucun Workspace n'est rattache a ce Portfolio.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {portfolio.workspaces.map((workspace) => (
              <article key={workspace.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-950">{workspace.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Slug : {workspace.slug}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      {workspace.categoryLabel} - {workspace.kindLabel}
                    </p>
                  </div>
                  <Link href={workspace.href} className="w-fit rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
                    Ouvrir
                  </Link>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
                  <Metric label="Parcours" value={workspace.journeyCount} />
                  <Metric label="Liens" value={workspace.gLinkCount} />
                  <Metric label="Dossiers" value={workspace.relationCaseCount} />
                  <Metric label="Comms" value={workspace.communicationSessionCount} />
                </dl>
                <form action={detachWorkspaceFromPortfolioAction} className="mt-4">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <button type="submit" className="text-xs font-semibold text-slate-500 underline underline-offset-4">
                    Detacher du Portfolio
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Workspaces disponibles a rattacher</h2>
        {availableWorkspaces.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed bg-slate-50 p-5 text-sm text-slate-600">
            Aucun Workspace actif sans Portfolio.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {availableWorkspaces.map((workspace) => (
              <article key={workspace.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-950">{workspace.name}</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {workspace.categoryLabel} - {workspace.kindLabel}
                    </p>
                  </div>
                  <form action={attachWorkspaceToPortfolioAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input type="hidden" name="portfolioId" value={portfolio.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                      Rattacher au Portfolio
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs font-semibold text-slate-500">
          Le rattachement d'un Workspace ne modifie pas ses parcours, dossiers, liens, communications ou acces candidats.
        </p>
      </section>

      <p className="mt-4 text-xs text-slate-500">Portfolio cree le {formatDate(portfolio.createdAt)}.</p>
    </main>
  );
}
