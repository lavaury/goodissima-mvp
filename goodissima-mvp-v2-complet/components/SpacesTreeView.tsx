"use client";
import Link from "next/link";
import { ObjectActionRow } from "@/components/ObjectActionRow";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { WorkspaceRow } from "@/components/WorkspaceRow";
import type { SpacesTree } from "@/lib/spaces-repository";
import { businessLabel } from "@/lib/spatial-navigation";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";
const openLink = `inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold ${focus}`;
function PortfolioBranch({ portfolio, initialOpen, first, firstWorkspaceId }: { portfolio: SpacesTree["portfolios"][number]; initialOpen: boolean; first: boolean; firstWorkspaceId?: string }) {
  const [open, setOpen] = useState(initialOpen);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    const reveal = () => flushSync(() => setOpen(true));
    element?.addEventListener("boussole:reveal-portfolio", reveal);
    return () => element?.removeEventListener("boussole:reveal-portfolio", reveal);
  }, []);
  const name = businessLabel(portfolio.name, "Portfolio", [portfolio.id]);
  return <li className="min-w-0"><div ref={root} data-boussole-portfolio="true" data-boussole-id={first ? "governance-first-portfolio" : undefined} className="rounded-xl border bg-slate-50 p-2 sm:p-4">
    <ObjectActionRow favorite={{ objectKind: "PORTFOLIO", objectId: portfolio.id }} name={name} href={`/gouvernance/portfolios/${encodeURIComponent(portfolio.id)}`} className="flex flex-wrap items-start gap-2 pr-16">
      <button type="button" aria-expanded={open} aria-controls={id} aria-label={`${open ? "Réduire" : "Développer"} le Portfolio : ${name}`} onClick={() => setOpen(value => !value)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-white ${focus}`}><span aria-hidden="true">{open ? "▾" : "▸"}</span></button>
      <div className="min-w-0 flex-1"><h3 className="break-words font-bold"><span aria-hidden="true">🗂 </span>{name}</h3><p className="mt-1 text-sm text-slate-600">Portfolio · {portfolio.status === "ACTIVE" ? "Actif" : "Archivé"} · {portfolio.workspaces.length} Workspaces</p></div>
      <Link href={`/gouvernance/portfolios/${encodeURIComponent(portfolio.id)}`} aria-label={`Ouvrir le Portfolio : ${name}`} className={openLink}>Ouvrir</Link>
    </ObjectActionRow>
    <div id={id} hidden={!open} data-boussole-portfolio-content="true" className="ml-2 mt-3 border-l-2 border-slate-300 pl-2 sm:ml-5 sm:pl-4">
      {portfolio.workspaces.length ? <ul aria-label={`Workspaces du Portfolio ${name}`} className="space-y-2">{portfolio.workspaces.map(workspace => <WorkspaceRow key={workspace.id} workspace={workspace} first={workspace.id === firstWorkspaceId} />)}</ul> : <p className="p-2 text-sm text-slate-600">Aucun Workspace dans ce Portfolio.</p>}
    </div>
  </div></li>;
}
export function SpacesTreeView({ data }: { data: SpacesTree }) {
  const firstWorkspaceId = data.portfolios.find(p => p.workspaces.length)?.workspaces[0]?.id ?? data.roots[0]?.id;
  const count = data.roots.length + data.portfolios.reduce((total, p) => total + p.workspaces.length, 0);
  return <section id="espaces" data-boussole-id="workspace-list" className="mt-6 space-y-6">
    <p data-boussole-id="governance-workspaces-count" className="text-sm text-slate-600">{count} Workspaces accessibles dans cette arborescence.</p>
    <section aria-labelledby="spaces-portfolios"><h2 id="spaces-portfolios" className="text-xl font-bold">Portfolios</h2>
      <p data-boussole-id="governance-workspace-portfolio-explanation" className="mt-2 text-sm text-slate-600">Un Portfolio regroupe des Workspaces. Chaque Workspace rassemble ses parcours, liens et dossiers.</p>
      {data.portfolios.length ? <ul className="mt-3 space-y-3">{data.portfolios.map((portfolio, index) => <PortfolioBranch key={portfolio.id} portfolio={portfolio} initialOpen={data.portfolios.length <= 5 || index === 0} first={index === 0} firstWorkspaceId={firstWorkspaceId} />)}</ul> : <p className="mt-3 text-sm text-slate-600">Vous n’avez pas encore de Portfolio.</p>}
    </section>
    <section aria-labelledby="spaces-roots"><h2 id="spaces-roots" data-boussole-id="governance-workspaces-section" className="text-xl font-bold">Workspaces sans Portfolio</h2>
      {data.roots.length ? <ul className="mt-3 space-y-2">{data.roots.map(workspace => <WorkspaceRow key={workspace.id} workspace={workspace} first={workspace.id === firstWorkspaceId} />)}</ul> : <p className="mt-3 text-sm text-slate-600">Aucun Workspace sans Portfolio.</p>}
    </section>
    {!count && !data.unavailableParentCount ? <p data-boussole-id="governance-empty-state" className="rounded-xl border border-dashed p-4">Vous n’avez pas encore de Workspace. Créez-en un avec « + Nouveau ».</p> : null}
    {data.unavailableParentCount > 0 ? <p className="rounded-xl border p-4 text-sm">{data.unavailableParentCount} Workspace(s) ne peuvent pas être affichés : leur Portfolio n’est pas accessible.</p> : null}
  </section>;
}
