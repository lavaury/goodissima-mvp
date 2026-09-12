export const dynamic = "force-dynamic";

import Link from "next/link";
import { HistoryBackButton } from "@/components/HistoryBackButton";
import { OpportunityCollection, type OpportunityCollectionRow } from "@/components/OpportunityCollection";
import { announcementListView } from "@/lib/announcement-archive";
import { getArchivedOpportunitySummaryForOwner } from "@/lib/archived-opportunity-repository";
import { getCurrentPrismaUser } from "@/lib/auth";
import { opportunityOwnerHref, projectOpportunity } from "@/lib/opportunities/opportunity-projection";
import { prisma } from "@/lib/prisma";
import { getAccessibleRelationTemplateIds } from "@/lib/relation-template-access";

export default async function OpportunitiesPage({ searchParams }: { searchParams?: { templateId?: string; view?: string } }) {
  const owner = await getCurrentPrismaUser();
  const view = announcementListView(searchParams?.view);
  const templateFilter = searchParams?.templateId ? { templateId: searchParams.templateId } : {};
  const announcements = await prisma.gLink.findMany({ where: { ownerId: owner.id, status: view === "archived" ? "ARCHIVED" : { not: "ARCHIVED" }, ...templateFilter }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, city: true, status: true, rules: true, templateId: true } });
  const archivedOpportunitySummary = await getArchivedOpportunitySummaryForOwner(owner.id, searchParams?.templateId);
  const archivedJourneys = archivedOpportunitySummary.journeys;
  const totalArchivedCount = archivedOpportunitySummary.count;
  const accessibleTemplateIds = await getAccessibleRelationTemplateIds(owner.id);
  const [draftLinkCount, historicalDraftCount, publishedCount, suspendedCount, closedCount] = await Promise.all([
    prisma.gLink.count({ where: { ownerId: owner.id, status: "DRAFT" } }),
    prisma.relationTemplate.count({ where: { status: "DRAFT", id: { in: accessibleTemplateIds }, links: { none: { ownerId: owner.id, status: "DRAFT" } } } }),
    prisma.gLink.count({ where: { ownerId: owner.id, status: "ACTIVE" } }),
    prisma.gLink.count({ where: { ownerId: owner.id, status: "DISABLED" } }),
    prisma.gLink.count({ where: { ownerId: owner.id, status: "EXPIRED" } }),
  ]);
  const counters = [
    ["Brouillons", draftLinkCount + historicalDraftCount, "opportunity-status-draft"],
    ["Publiées", publishedCount, "opportunity-status-active"],
    ["Suspendues", suspendedCount, "opportunity-status-suspended"],
    ["Clôturées", closedCount, "opportunity-status-closed"],
  ] as const;
  const rows: OpportunityCollectionRow[] = announcements.map((item) => { const projection = projectOpportunity(item); return { id: item.id, title: item.title, status: item.status, type: projection?.type ?? null, subject: projection?.structuredCriteria?.subject ?? null, location: projection?.structuredCriteria?.locations?.[0] ?? item.city ?? null, href: opportunityOwnerHref(item) }; });

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
    <nav aria-label="Fil d’Ariane" className="text-sm text-slate-600"><Link href="/">Accueil</Link> <span aria-hidden="true">›</span> <span aria-current="page">Opportunités</span></nav>
    <div className="mt-3"><HistoryBackButton /></div>
    <header data-boussole-id="opportunities-overview" className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Opportunités</h1><p className="mt-2 max-w-2xl text-slate-600">Publiez ce que vous recherchez ou proposez, puis suivez vos opportunités.</p></div><Link href="/opportunities/new" data-boussole-id="create-opportunity" className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Créer une opportunité</Link></header>
    <section data-boussole-id="opportunities-summary" aria-label="Résumé des statuts" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{counters.map(([label, value, target]) => <div key={label} data-boussole-id={target} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</section>
    <div className="mt-5 flex justify-end"><Link href={view === "archived" ? "/opportunities" : "/opportunities?view=archived"} data-boussole-id="open-archives" className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline">{view === "archived" ? "Voir les opportunités courantes" : `Archives (${totalArchivedCount})`}</Link></div>
    {view === "active" ? <OpportunityCollection rows={rows} /> : <div data-boussole-id="opportunities-list" className="mt-6">{rows.length || archivedJourneys.length ? <div className="overflow-hidden rounded-2xl border bg-white">
      {rows.map((row) => <article key={row.id} className="flex items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">{row.title}</h2><p className="text-sm text-slate-600">Opportunité archivée</p></div><Link href={row.href} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">Ouvrir</Link></article>)}
      {archivedJourneys.map((journey) => <article key={journey.id} className="flex items-center justify-between gap-3 border-b p-4 last:border-b-0"><div><h2 className="font-semibold">{journey.name}</h2><p className="text-sm text-slate-600">Opportunité historique archivée · {journey._count.links} élément{journey._count.links > 1 ? "s" : ""}</p></div>{journey.formTemplates[0] ? <Link href={`/templates/${journey.formTemplates[0].id}`} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">Voir l’élément archivé</Link> : null}</article>)}
    </div> : <div className="rounded-2xl border border-dashed bg-white p-8 text-center"><h2 className="font-semibold">Aucune opportunité archivée</h2><p className="mt-2 text-sm text-slate-500">Les opportunités archivées resteront disponibles ici.</p></div>}</div>}
  </main>;
}
