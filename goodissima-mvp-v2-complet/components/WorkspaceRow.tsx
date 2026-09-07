import Link from "next/link";
import { businessLabel } from "@/lib/spatial-navigation";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";
const openLink = `inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold ${focus}`;
export type WorkspaceRowData = { id: string; name: string; status: string; _count: { relationTemplates: number; links: number; relationCases: number } };
export function WorkspaceRow({ workspace, first = false, firstTarget = "governance-first-workspace" }: { workspace: WorkspaceRowData; first?: boolean; firstTarget?: string }) {
  return <li data-boussole-id={first ? firstTarget : undefined} className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><h3 className="break-words font-bold"><span aria-hidden="true">📁 </span><Link href={`/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`} className={`rounded underline underline-offset-4 ${focus}`}>{businessLabel(workspace.name, "Workspace", [workspace.id])}</Link></h3>
        <p className="mt-1 text-sm text-slate-600">Workspace · {workspace.status === "ACTIVE" ? "Actif" : "Archivé"}</p>
        <p data-boussole-id={first ? "workspace-object-counts" : undefined} className="mt-2 text-sm text-slate-600">{workspace._count.relationTemplates} parcours · {workspace._count.links} liens · {workspace._count.relationCases} dossiers</p>
      </div>
      <Link data-boussole-id={first ? "open-workspace" : undefined} href={`/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`} aria-label={`Ouvrir le Workspace : ${businessLabel(workspace.name, "Workspace", [workspace.id])}`} className={openLink}>Ouvrir</Link>
    </div>
  </li>;
}
