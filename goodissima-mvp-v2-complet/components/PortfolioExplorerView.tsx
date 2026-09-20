import Link from "next/link";
import type { ReactNode } from "react";
import { WorkspaceRow } from "@/components/WorkspaceRow";
import { SpacesCreateActions } from "@/components/SpacesCreateActions";
import { PageNavigationContext } from "@/components/SpatialNavigationContext";
import { businessLabel, portfolioBreadcrumb } from "@/lib/spatial-navigation";
import type { PortfolioExplorer } from "@/lib/portfolio-explorer-repository";

const control = "inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";
export function PortfolioExplorerView({ portfolio, kindLabel, organize }: { portfolio: PortfolioExplorer; kindLabel: string; organize: ReactNode }) {
  const name = businessLabel(portfolio.name, "Portfolio", [portfolio.id]);
  const totals = portfolio.workspaces.reduce((sum, workspace) => ({
    journeys: sum.journeys + workspace._count.relationTemplates, links: sum.links + workspace._count.links,
    cases: sum.cases + workspace._count.relationCases, communications: sum.communications + workspace._count.communicationSessions,
  }), { journeys: 0, links: 0, cases: 0, communications: 0 });
  return <main className="mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-6">
    <PageNavigationContext pathname={`/gouvernance/portfolios/${encodeURIComponent(portfolio.id)}`} items={portfolioBreadcrumb(portfolio)} />
    <header data-boussole-id="portfolio-detail-overview">
      <h1 className="break-words text-3xl font-bold">{name}</h1>
      <p className="mt-2 text-sm text-slate-600">Portfolio · {portfolio.status === "ACTIVE" ? "Actif" : "Archivé"}</p>
      {portfolio.description ? <p className="mt-3 max-w-4xl break-words text-sm text-slate-700">{portfolio.description}</p> : null}
    </header>
    <div className="mt-5 flex flex-wrap items-start gap-3">
      {portfolio.status === "ACTIVE" ? <SpacesCreateActions portfolioId={portfolio.id} /> : null}
      <Link data-boussole-id="portfolio-open-pilotage" href={`/gouvernance/portfolios/${encodeURIComponent(portfolio.id)}/pilotage`} className={`${control} bg-slate-900 text-white`}>Piloter</Link>
      <details className="min-w-0 basis-full rounded-xl border bg-white sm:basis-auto sm:flex-1" data-portfolio-organize>
        <summary data-boussole-id="portfolio-organize" className="min-h-11 cursor-pointer rounded-xl px-4 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Organiser</summary>
        <div className="border-t p-3 sm:p-4">{organize}</div>
      </details>
    </div>
    <section aria-labelledby="portfolio-workspaces-heading" className="mt-6" data-boussole-id="portfolio-workspaces">
      <h2 id="portfolio-workspaces-heading" className="text-xl font-bold">Workspaces <span className="text-sm font-normal text-slate-600">· {portfolio.workspaces.length}</span></h2>
      {portfolio.workspaces.length ? <ul className="mt-3 space-y-3">{portfolio.workspaces.map((workspace, index) => <WorkspaceRow key={workspace.id} workspace={workspace} first={index === 0} firstTarget="portfolio-first-workspace" />)}</ul>
        : <p data-boussole-id="portfolio-no-workspaces" className="mt-3 rounded-xl border border-dashed p-4 text-sm text-slate-600">Aucun Workspace dans ce Portfolio.</p>}
    </section>
    <details className="mt-6 rounded-xl border bg-white" data-portfolio-information>
      <summary className="min-h-11 cursor-pointer rounded-xl px-4 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Informations</summary>
      <div className="space-y-3 border-t p-4 text-sm text-slate-600">
        <dl className="space-y-2 break-words">
          <div><dt className="font-semibold">Type</dt><dd>{kindLabel}</dd></div>
          <div><dt className="font-semibold">Slug</dt><dd>{portfolio.slug}</dd></div>
          <div><dt className="font-semibold">Date de création</dt><dd>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(portfolio.createdAt)}</dd></div>
          <div><dt className="font-semibold">Contenus directement rattachés aux Workspaces</dt><dd>{totals.journeys} parcours · {totals.links} liens · {totals.cases} dossiers · {totals.communications} communications</dd></div>
        </dl>
        <Link href="/gouvernance/portfolios" className={control}>Tous les Portfolios</Link>
      </div>
    </details>
  </main>;
}
