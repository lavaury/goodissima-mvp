import Link from "next/link";
import type { WorkspaceDetail } from "@/lib/workspace-detail-repository";
import { businessLabel, workspaceBreadcrumb } from "@/lib/spatial-navigation";
import { PageNavigationContext } from "@/components/SpatialNavigationContext";
import type { ReactNode } from "react";
import { WorkspaceCreateActions } from "@/components/WorkspaceCreateActions";

const labels: Record<string, string> = {
  ACTIVE: "Actif", ARCHIVED: "Archivé", DRAFT: "Brouillon", PUBLISHED: "Publié",
  DISABLED: "Désactivé", EXPIRED: "Expiré", NEW: "Nouveau", IN_PROGRESS: "En cours",
  ACCEPTED: "Accepté", REJECTED: "Refusé", CLOSED: "Clôturé", PENDING_REVIEW: "À examiner",
  WAITING_CANDIDATE: "En attente du candidat", WAITING_OWNER: "En attente du propriétaire", REVIEWING: "En examen", VALIDATED: "Validé",
  GOVERNANCE: "Gouvernance", RELATION: "Relation", MIXED: "Mixte", PROFESSIONAL: "Professionnel",
  PRIVATE: "Privé", FAMILY: "Famille", ASSOCIATION: "Association", PROJECT: "Projet", CLIENT: "Client", OTHER: "Autre",
};
export function WorkspaceDetailView({ workspace, explorer = false, pilotage }: { workspace: WorkspaceDetail; explorer?: boolean; pilotage?: ReactNode }) {
  const pathname = `/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`;
  const rows = [
    ...workspace.relationTemplates.map(item => ({ key: `journey-${item.id}`, name: businessLabel(item.formTemplates[0]?.name || item.name, "Parcours", [item.id]), type: "Parcours", status: item.status,
      href: item.formTemplates[0] ? `/gouvernance/parcours/${encodeURIComponent(item.formTemplates[0].id)}/pilotage` : null })),
    ...workspace.links.map(item => ({ key: `link-${item.id}`, name: businessLabel(item.title, "Lien", [item.id]), type: "Lien", status: item.status, href: `/links/${encodeURIComponent(item.id)}` })),
    ...workspace.relationCases.map(item => ({ key: `case-${item.id}`, name: businessLabel(`${item.candidateName} — ${item.gLink.title}`, "Dossier relationnel", [item.id]), type: "Dossier", status: item.status, href: `/cases/${encodeURIComponent(item.id)}` })),
  ];
  return <main className="mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-6">
    <PageNavigationContext pathname={pathname} items={workspaceBreadcrumb(workspace)} />
    <h1 className="break-words text-3xl font-bold">{businessLabel(workspace.name, "Workspace", [workspace.id])}</h1>
    <p className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600"><span>{labels[workspace.category]}</span><span>· {labels[workspace.kind]}</span><strong>· {labels[workspace.status]}</strong></p>
    {workspace.description ? <p className="mt-3 whitespace-pre-wrap break-words text-slate-600">{workspace.description}</p> : null}
    {workspace.status === "ACTIVE" ? <WorkspaceCreateActions key={workspace.id} workspaceId={workspace.id} /> : null}
    <nav aria-label="Vues du Workspace" className="mt-6 flex flex-wrap gap-2">
      {[{ href: pathname, label: "🎛 Piloter", active: !explorer }, { href: `${pathname}?view=explorer`, label: "📂 Explorer", active: explorer }].map(view => <Link key={view.href} href={view.href} aria-current={view.active ? "page" : undefined} className={`rounded-xl px-4 py-3 font-semibold ${view.active ? "bg-slate-900 text-white" : "border bg-white text-slate-700"}`}>{view.label}</Link>)}
    </nav>
    {explorer ? <section className="mt-6" aria-label="Objets directement rattachés">
      <h2 className="text-xl font-bold">Explorer</h2><p className="mt-2 text-sm text-slate-600">Parcours, liens et dossiers directement rattachés à cet espace.</p>
      {rows.length ? <ul className="mt-4 space-y-3">{rows.map(row => <li key={row.key} className="grid min-w-0 gap-3 rounded-xl border bg-white p-4 md:grid-cols-[minmax(0,1fr)_7rem_8rem_10rem] md:items-center">
        <h3 className="min-w-0 break-words font-semibold">{row.name}</h3><span className="text-sm text-slate-600">{row.type}</span><span className="break-words text-sm">{labels[row.status] ?? row.status}</span>
        {row.href ? <Link href={row.href} aria-label={`Ouvrir : ${row.name}`} className="w-fit rounded-lg border px-4 py-2 text-sm font-semibold">Ouvrir</Link> : <span className="text-sm text-slate-500">Aucun formulaire disponible pour ouvrir ce parcours.</span>}
      </li>)}</ul> : <p className="mt-4 rounded-xl border border-dashed p-5 text-slate-600">Aucun parcours, lien ou dossier directement rattaché à cet espace.</p>}
    </section> : pilotage}
  </main>;
}
