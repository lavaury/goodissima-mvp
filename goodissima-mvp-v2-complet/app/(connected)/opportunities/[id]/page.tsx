export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectOpportunity } from "@/lib/opportunities/opportunity-projection";
import type { OpportunityDay } from "@/lib/opportunities/contracts";
import { AutonomousOpportunityManager } from "@/components/AutonomousOpportunityManager";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { announcementStatusLabel } from "@/lib/announcement-archive";
import { HistoryBackButton } from "@/components/HistoryBackButton";
import { isStructuredOpportunityMatchingEnabled } from "@/lib/opportunities/matching/matchable-projection";
import { OpportunityMatchingControls } from "@/components/OpportunityMatchingControls";
import { RelationRequestsPanel } from "@/components/RelationRequestsPanel";
import { relationRequestNotificationAuditTypes } from "@/lib/public-relation-request-history";
import { projectRelationRequestView } from "@/lib/relation-request-view";
import { Prisma } from "@prisma/client";

const dayLabels: Record<OpportunityDay, string> = {
  MONDAY: "Lundi", TUESDAY: "Mardi", WEDNESDAY: "Mercredi", THURSDAY: "Jeudi",
  FRIDAY: "Vendredi", SATURDAY: "Samedi", SUNDAY: "Dimanche",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-base font-semibold text-slate-900">{children}</dd></div>;
}

export default async function AutonomousOpportunityPage({ params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const item = await prisma.gLink.findFirst({
    where: { id: params.id, ownerId: owner.id },
    select: {
      id: true, slug: true, title: true, description: true, status: true, expiresAt: true, rules: true, templateId: true,
      publicCaseCreationRequests: { where: { status: { in: ["PENDING", "ACCEPTED", "DECLINED"] }, requestPayload: { not: Prisma.DbNull } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, status: true, requestPayload: true, relationCaseId: true, createdAt: true, decidedAt: true, decidedByUserId: true, declineReason: true, decidedByUser: { select: { name: true } }, relationCase: { select: { id: true, createdAt: true } } } },
      cases: { orderBy: { createdAt: "desc" }, select: { id: true, candidateName: true, createdAt: true, status: true } },
    },
  });
  if (!item) notFound();

  const projection = projectOpportunity(item);
  if (!projection) notFound();
  if (projection.legacy || projection.hasGovernedJourney) redirect(`/links/${encodeURIComponent(item.id)}`);
  if (!projection.structuredCriteria || !projection.type) notFound();

  const relationRequestAudits = item.publicCaseCreationRequests.length ? await prisma.auditLog.findMany({ where: { eventType: { in: [...relationRequestNotificationAuditTypes] }, OR: item.publicCaseCreationRequests.map((request) => ({ metadata: { path: ["requestId"], equals: request.id } })) }, select: { eventType: true, metadata: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }) : [];
  const relationRequests = item.publicCaseCreationRequests.flatMap((request) => { const view = projectRelationRequestView(request, relationRequestAudits); return view ? [view] : []; });
  const requestCaseIds = new Set(relationRequests.flatMap((request) => request.relationCaseId ? [request.relationCaseId] : []));
  const legacyCases = item.cases.filter((relationCase) => !requestCaseIds.has(relationCase.id));
  const responseCount = relationRequests.length + legacyCases.length;
  const pendingCount = relationRequests.filter((request) => request.status === "PENDING").length;
  const acceptedCount = relationRequests.filter((request) => request.status === "ACCEPTED").length;
  const declinedCount = relationRequests.filter((request) => request.status === "DECLINED").length;

  const criteria = projection.structuredCriteria;
  const availability = criteria.availability;
  const dateWindow = criteria.dateWindow;
  const priceRange = criteria.priceRange;

  return <main className="mx-auto max-w-3xl px-6 py-10">
    <nav aria-label="Fil d’Ariane" className="text-sm text-slate-600">
      <Link href="/">Accueil</Link> <span aria-hidden="true">›</span> <Link href="/opportunities">Opportunités</Link> <span aria-hidden="true">›</span> <span aria-current="page">{item.title}</span>
    </nav>
    <div className="mt-6"><HistoryBackButton /></div>

    <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Opportunité</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{item.title}</h1></div>
      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">{announcementStatusLabel(item.status)}</span>
    </header>

    {item.status === "DRAFT" ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">Brouillon — cette opportunité n’est pas encore publiée.</p> : null}

    <dl className="mt-6 grid gap-4 sm:grid-cols-2">
      <Field label={projection.type === "NEED" ? "Je recherche" : "Je propose"}>{criteria.subject}</Field>
      {criteria.category ? <Field label="Catégorie">{criteria.category}</Field> : null}
      {criteria.locations?.length ? <Field label="Lieu">{criteria.locations.join(", ")}</Field> : null}
      {availability?.days?.length ? <Field label="Jours">{availability.days.map(day => dayLabels[day]).join(", ")}</Field> : null}
      {availability?.timeFrom || availability?.timeTo ? <Field label="Horaires">{availability.timeFrom ?? "…"} → {availability.timeTo ?? "…"}</Field> : null}
      {dateWindow?.from || dateWindow?.to ? <Field label="Dates">{dateWindow.from ?? "…"} → {dateWindow.to ?? "…"}</Field> : null}
      {priceRange ? <Field label="Budget">{priceRange.min ?? "…"} → {priceRange.max ?? "…"} {priceRange.currency}{priceRange.unit ? ` / ${priceRange.unit}` : ""}</Field> : null}
      {criteria.terms?.length ? <Field label="Critères complémentaires">{criteria.terms.join(", ")}</Field> : null}
    </dl>

    {item.description ? <section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold text-slate-950">Description</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{item.description}</p></section> : null}
    <AutonomousOpportunityManager id={item.id} initialStatus={item.status} publicUrl={`${getPublicAppUrl()}/l/${item.slug}`} initialTitle={item.title} initialDescription={item.description ?? ""} initialType={projection.type} initialCriteria={criteria} initialExpiresAt={item.expiresAt ? item.expiresAt.toISOString().slice(0, 10) : ""} />
    <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">Réponses</h2><p className="mt-1 text-sm text-slate-500">Consultez les demandes envoyées depuis cette opportunité.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{responseCount} réponse{responseCount > 1 ? "s" : ""}</span></div>
      {responseCount === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucune réponse pour le moment.</p> : <><p className="mt-4 text-sm text-slate-600">{pendingCount} en attente · {acceptedCount} acceptée{acceptedCount > 1 ? "s" : ""} · {declinedCount} refusée{declinedCount > 1 ? "s" : ""}</p>{relationRequests.length ? <RelationRequestsPanel requests={relationRequests} gLinkId={item.id} /> : null}{legacyCases.length ? <div className="mt-5 space-y-3">{legacyCases.map((relationCase) => <article key={relationCase.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-semibold">{relationCase.candidateName}</p><p className="mt-1 text-xs text-slate-500">Dossier historique · {relationCase.createdAt.toLocaleDateString("fr-FR")}</p></div><Link href={`/cases/${relationCase.id}?refresh=1`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Ouvrir le dossier</Link></article>)}</div> : null}</>}
    </section>
    <OpportunityMatchingControls id={item.id} status={item.status} initialEnabled={isStructuredOpportunityMatchingEnabled(item.rules)} />
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/gouvernance" className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700">Voir dans Mes espaces</Link></div>
  </main>;
}
