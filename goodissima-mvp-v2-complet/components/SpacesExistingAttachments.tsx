import Link from "next/link";
import { OrganizationPanel } from "@/components/OrganizationPanel";
import { ObjectActionRow } from "@/components/ObjectActionRow";
import { attachGLinkToWorkspaceAction, attachGovernedJourneyToWorkspaceAction, attachRelationCaseToWorkspaceAction } from "@/lib/governance-workspace-actions";
import { getGovernanceWorkspaceOptions, getUnassignedGLinkSummaries, getUnassignedGovernedJourneySummaries, getUnassignedRelationCaseSummaries, type GovernanceWorkspaceOption } from "@/lib/governance-workspace-repository";
import { organizePage, organizeResults } from "@/lib/unassigned-pagination";

type Params = Record<string, string | string[] | undefined>;
const control = "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700";
const row = "min-w-0 border-b border-slate-200 py-4";
const children = "ml-2 min-w-0 border-l-2 border-slate-200 pl-2 sm:ml-6 sm:pl-4";
const formClass = "mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end";
function formatDate(value: Date) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value); }
function linkStatusLabel(status: string) { return status === "DRAFT" ? "Brouillon" : status === "ACTIVE" ? "Publiée" : status === "DISABLED" ? "Suspendue" : status === "EXPIRED" ? "Clôturée" : "Archivée"; }
function Pages({ name, label, params, hasMore }: { name: string; label: string; params: Params; hasMore: boolean }) {
  const page = organizePage(params[name]);
  function href(next: number) {
    const query = new URLSearchParams();
    for (const key of ["linksPage", "journeysPage", "casesPage", "workspacesPage"]) {
      const value = key === name ? next : organizePage(params[key]);
      if (value) query.set(key, String(value));
    }
    return `/gouvernance?${query}#a-organiser`;
  }
  return <nav aria-label={`Pages : ${label}`} className="mt-2 flex flex-wrap gap-2">
    {page > 0 ? <Link className={control} href={href(page - 1)}>Précédent — {label}</Link> : null}
    {hasMore ? <Link className={control} href={href(page + 1)}>Voir plus — {label}</Link> : null}
  </nav>;
}
function Destination({ options, title, selectTarget, buttonTarget }: { options: GovernanceWorkspaceOption[]; title: string; selectTarget?: string; buttonTarget?: string }) {
  return <>
    <input type="hidden" name="attachmentMode" value="unassigned" />
    <label className="flex min-w-0 flex-1 flex-col gap-1 break-words text-sm">Workspace pour {title}
      <select name="workspaceId" required data-boussole-id={selectTarget} className={`${control} w-full min-w-0 bg-white`} defaultValue="">
        <option value="" disabled>Choisir un Workspace</option>
        {options.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name} — {workspace.categoryLabel}</option>)}
      </select>
    </label>
    <button type="submit" data-boussole-id={buttonTarget} className={`${control} shrink-0 self-start bg-slate-900 text-white sm:self-end`}>Rattacher au Workspace</button>
  </>;
}
export async function SpacesExistingAttachments({ ownerId, params = {} }: { ownerId: string; params?: Params }) {
  const [options, journeys, cases, links] = await Promise.all([
    getGovernanceWorkspaceOptions(ownerId, organizePage(params.workspacesPage)),
    getUnassignedGovernedJourneySummaries(ownerId, organizePage(params.journeysPage)),
    getUnassignedRelationCaseSummaries(ownerId, organizePage(params.casesPage)),
    getUnassignedGLinkSummaries(ownerId, organizePage(params.linksPage)),
  ]);
  const workspaces = organizeResults(options);
  return <section id="a-organiser" aria-labelledby="organize-title" className="mt-8 min-w-0 border-t pt-6">
    <h2 id="organize-title" className="text-xl font-bold">À organiser</h2>
    <p className="mt-2 text-sm text-slate-600">Ces objets ne sont actuellement rattachés à aucun Workspace. Vous pouvez les utiliser ainsi ou les organiser quand vous le souhaitez.</p>
    {!workspaces.items.length ? <p id="organize-no-destination" tabIndex={-1} data-boussole-id="no-workspace-available-for-attachment" className="mt-3 text-sm text-slate-600">Aucun Workspace actif disponible sur cette page de destinations.</p> : null}
    <Pages name="workspacesPage" label="Workspaces disponibles" params={params} hasMore={workspaces.hasMore} />
    <section data-boussole-id="governed-journeys-without-workspace" aria-labelledby="unassigned-journeys-title" className="mt-5">
      <h3 id="unassigned-journeys-title" className="flex items-center gap-2 font-bold"><span aria-hidden="true">🧭</span>Parcours gouvernés</h3>
      <div className={children}>
      {!journeys.items.length ? <p data-boussole-id="no-unassigned-governed-journeys" className="py-3 text-sm text-slate-600">Aucun parcours à organiser sur cette page.</p> : journeys.items.map((journey, index) => <ObjectActionRow as="article" favorite={{ objectKind: "RELATION_TEMPLATE", objectId: journey.relationTemplateId }} name={journey.title} href={journey.href} attachmentTargetId={workspaces.items.length ? `attach-journey-${journey.formTemplateId}` : "organize-no-destination"} key={journey.formTemplateId} data-boussole-id={index === 0 ? "first-unassigned-governed-journey" : undefined} className={row}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 pr-16">
          <div className="min-w-0 flex-1"><h4 data-boussole-id={index === 0 ? "unassigned-journey-title" : undefined} className="break-words font-semibold">{journey.title}</h4>
            <p className="text-sm text-slate-600">Parcours gouverné · <span data-boussole-id={index === 0 ? "unassigned-journey-created-at" : undefined}>Créé le {formatDate(journey.createdAt)}</span></p></div>
          <Link href={journey.href} data-boussole-id={index === 0 ? "open-unassigned-journey-cockpit" : undefined} aria-label={`Ouvrir le parcours : ${journey.title}`} className={control}>Ouvrir</Link>
        </div>
        <OrganizationPanel><p className="mt-2 text-sm text-slate-600">Le rattachement met à jour le Workspace du parcours et ses informations de version. Les liens et dossiers associés restent à leur emplacement.</p>
        {workspaces.items.length ? <form id={`attach-journey-${journey.formTemplateId}`} action={attachGovernedJourneyToWorkspaceAction} className={formClass}>
          <input type="hidden" name="formTemplateId" value={journey.formTemplateId} />
          <Destination options={workspaces.items} title={journey.title} selectTarget={index === 0 ? "select-workspace-for-journey" : undefined} buttonTarget={index === 0 ? "attach-journey-to-workspace" : undefined} />
        </form> : null}</OrganizationPanel>
      </ObjectActionRow>)}
      </div>
      <Pages name="journeysPage" label="Parcours" params={params} hasMore={journeys.hasMore} />
    </section>
    <div data-boussole-id="relational-cases-workspace-attachment">
    <section aria-labelledby="unassigned-links-title" className="mt-5">
      <h3 id="unassigned-links-title" className="flex items-center gap-2 font-bold"><span aria-hidden="true">🔗</span>Liens et opportunités</h3>
      <div className={children}>
      {!links.items.length ? <p className="py-3 text-sm text-slate-600">Aucun lien ou opportunité à organiser sur cette page.</p> : links.items.map(link => <ObjectActionRow as="article" favorite={{ objectKind: "GLINK", objectId: link.id }} name={link.title} href={link.href} attachmentTargetId={workspaces.items.length ? `attach-link-${link.id}` : "organize-no-destination"} key={link.id} className={row}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 pr-16"><div className="min-w-0 flex-1"><h4 className="break-words font-semibold">{link.title}</h4><p className="text-sm text-slate-600">{link.objectLabel} · {linkStatusLabel(link.status)} · Créé le {formatDate(link.createdAt)}</p></div>
          <Link href={link.href} aria-label={`Ouvrir : ${link.title}`} className={control}>Ouvrir</Link></div>
        <OrganizationPanel><p className="mt-2 text-sm text-slate-600">Seul ce lien sera rattaché. Ses dossiers restent à leur emplacement.</p>
        {workspaces.items.length ? <form id={`attach-link-${link.id}`} action={attachGLinkToWorkspaceAction} className={formClass}>
          <input type="hidden" name="gLinkId" value={link.id} />
          <Destination options={workspaces.items} title={link.title} />
        </form> : null}</OrganizationPanel>
      </ObjectActionRow>)}
      </div>
      <Pages name="linksPage" label="Liens et opportunités" params={params} hasMore={links.hasMore} />
    </section>
    <section aria-labelledby="unassigned-cases-title" className="mt-5">
      <h3 id="unassigned-cases-title" className="flex items-center gap-2 font-bold"><span aria-hidden="true">📁</span>Dossiers</h3>
      {!cases.items.length ? <p data-boussole-id="no-unassigned-relational-cases" className={`${children} py-3 text-sm text-slate-600`}>Aucun dossier à organiser sur cette page.</p> : <div data-boussole-id="relational-cases-without-workspace" className={children}>{cases.items.map((relationCase, index) => <ObjectActionRow as="article" favorite={{ objectKind: "RELATION_CASE", objectId: relationCase.id }} name={relationCase.title} href={relationCase.href} attachmentTargetId={workspaces.items.length ? `attach-case-${relationCase.id}` : "organize-no-destination"} key={relationCase.id} data-boussole-id={index === 0 ? "first-unassigned-relational-case" : undefined} className={row}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 pr-16"><div className="min-w-0 flex-1"><h4 className="break-words font-semibold">{relationCase.title}</h4><p className="text-sm text-slate-600">Dossier · Créé le {formatDate(relationCase.createdAt)}</p></div>
          <Link href={relationCase.href} aria-label={`Ouvrir le dossier : ${relationCase.title}`} className={control}>Ouvrir</Link></div>
        <OrganizationPanel><p className="mt-2 break-words text-sm text-slate-600">Le lien parent « {relationCase.gLinkTitle} » sera aussi rattaché s’il vous appartient et n’a aucun Workspace au moment de la confirmation. Les autres dossiers restent à leur emplacement.</p>
        {workspaces.items.length ? <form id={`attach-case-${relationCase.id}`} action={attachRelationCaseToWorkspaceAction} className={formClass}>
          <input type="hidden" name="relationCaseId" value={relationCase.id} />
          <Destination options={workspaces.items} title={relationCase.title} selectTarget={index === 0 ? "select-workspace-for-relational-case" : undefined} buttonTarget={index === 0 ? "attach-relational-case-to-workspace" : undefined} />
        </form> : null}</OrganizationPanel>
      </ObjectActionRow>)}</div>}
      <Pages name="casesPage" label="Dossiers" params={params} hasMore={cases.hasMore} />
    </section>
    </div>
  </section>;
}
