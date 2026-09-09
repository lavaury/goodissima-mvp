import Link from "next/link";
import { OrganizationPanel } from "@/components/OrganizationPanel";
import { attachWorkspaceToPortfolioAction } from "@/lib/governance-portfolio-actions";
import { ObjectActionRow } from "@/components/ObjectActionRow";
import { businessLabel } from "@/lib/spatial-navigation";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";
const openLink = `inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold ${focus}`;
export type WorkspaceRowData = { id: string; name: string; status: string; _count: { relationTemplates: number; links: number; relationCases: number } };
export function WorkspaceRow({ workspace, first = false, firstTarget = "governance-first-workspace", portfolios, portfolioId }: { workspace: WorkspaceRowData; first?: boolean; firstTarget?: string; portfolios?: { id: string; name: string; status: string }[]; portfolioId?: string | null }) {
  const choices = portfolios?.filter(p => p.status === "ACTIVE" && p.id !== portfolioId);
  const attachmentId = `workspace-portfolio-${workspace.id}`;
  const label = portfolioId ? "Déplacer vers un autre Portfolio…" : "Rattacher à un Portfolio…";
  return <ObjectActionRow as="li" attachmentTargetId={portfolios ? attachmentId : undefined} attachmentLabel={label} favorite={{ objectKind: "WORKSPACE", objectId: workspace.id }} name={businessLabel(workspace.name, "Workspace", [workspace.id])} href={`/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`} data-boussole-id={first ? firstTarget : undefined} className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 pr-14">
      <div className="min-w-0 flex-1"><h3 className="break-words font-bold"><span aria-hidden="true">📁 </span><Link href={`/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`} className={`rounded underline underline-offset-4 ${focus}`}>{businessLabel(workspace.name, "Workspace", [workspace.id])}</Link></h3>
        <p className="mt-1 text-sm text-slate-600">Workspace · {workspace.status === "ACTIVE" ? "Actif" : "Archivé"}</p>
        <p data-boussole-id={first ? "workspace-object-counts" : undefined} className="mt-2 text-sm text-slate-600">{workspace._count.relationTemplates} parcours · {workspace._count.links} liens · {workspace._count.relationCases} dossiers</p>
      </div>
      <Link data-boussole-id={first ? "open-workspace" : undefined} href={`/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`} aria-label={`Ouvrir le Workspace : ${businessLabel(workspace.name, "Workspace", [workspace.id])}`} className={openLink}>Ouvrir</Link>
    </div>
    {portfolios && <OrganizationPanel>
      <form tabIndex={-1} id={attachmentId} action={attachWorkspaceToPortfolioAction}>
        <input type="hidden" name="workspaceId" value={workspace.id} />
        <p className="text-sm text-slate-600">Seule l’organisation du Workspace change. Ses objets et leurs accès restent inchangés.</p>
        {choices?.length ? <>
          <label className="mt-2 flex min-w-0 flex-col gap-1 text-sm">{label}
            <select name="portfolioId" required defaultValue="" className={`min-h-11 w-full min-w-0 rounded-lg border bg-white px-2 ${focus}`}>
              <option value="" disabled>Choisir un Portfolio</option>
              {choices.map(p => <option key={p.id} value={p.id}>{businessLabel(p.name, "Portfolio", [p.id])}</option>)}
            </select>
          </label>
          <button type="submit" className={`mt-2 ${openLink}`}>{portfolioId ? "Déplacer" : "Rattacher"}</button>
        </> : <p tabIndex={-1} className="mt-2 text-sm">Aucun autre Portfolio actif disponible.</p>}
      </form>
    </OrganizationPanel>}
  </ObjectActionRow>;
}
