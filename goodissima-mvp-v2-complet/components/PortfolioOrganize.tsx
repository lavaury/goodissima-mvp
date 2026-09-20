import type { PortfolioExplorer } from "@/lib/portfolio-explorer-repository";
import type { GovernancePortfolioWorkspaceOption } from "@/lib/governance-portfolio-repository";
import { attachWorkspaceToPortfolioAction, detachWorkspaceFromPortfolioAction } from "@/lib/governance-portfolio-actions";
import { businessLabel } from "@/lib/spatial-navigation";

const button = "min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";
export function PortfolioOrganize({ portfolio, available }: { portfolio: PortfolioExplorer; available: GovernancePortfolioWorkspaceOption[] }) {
  return <div className="space-y-5">
    <p className="text-sm text-slate-600">Rattacher ou détacher un Workspace change son organisation, sans modifier ses parcours, dossiers, liens, communications ou accès candidats. Détacher ne supprime pas le Workspace.</p>
    <section><h2 className="font-bold">Workspaces de ce Portfolio</h2>
      {portfolio.workspaces.length ? <ul className="mt-2 space-y-2">{portfolio.workspaces.map(workspace => <li key={workspace.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <span className="min-w-0 flex-1 break-words">{businessLabel(workspace.name, "Workspace", [workspace.id])}</span>
        <form action={detachWorkspaceFromPortfolioAction}><input type="hidden" name="workspaceId" value={workspace.id} /><button type="submit" className={button}>Détacher du Portfolio</button></form>
      </li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucun Workspace à détacher.</p>}
    </section>
    <section><h2 className="font-bold">Rattacher un Workspace</h2>
      {portfolio.status !== "ACTIVE" ? <p className="mt-2 text-sm text-slate-600">Ce Portfolio est archivé : aucun rattachement n’est disponible.</p>
        : available.length ? <ul className="mt-2 space-y-2">{available.map(workspace => <li key={workspace.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <span className="min-w-0 flex-1 break-words">{businessLabel(workspace.name, "Workspace", [workspace.id])}</span>
          <form action={attachWorkspaceToPortfolioAction}><input type="hidden" name="portfolioId" value={portfolio.id} /><input type="hidden" name="workspaceId" value={workspace.id} /><button type="submit" className={button}>Rattacher au Portfolio</button></form>
        </li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucun Workspace actif sans Portfolio.</p>}
    </section>
  </div>;
}
