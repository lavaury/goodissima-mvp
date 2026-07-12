export const dynamic = "force-dynamic";

import Link from "next/link";
import { LinkCard } from "@/components/LinkCard";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { ProductLifecycle, ProductObjectDefinition } from "@/components/ProductObjectClarity";
import { announcementListView } from "@/lib/announcement-archive";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { isDemoSurfaceEnabled } from "@/lib/debug";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams?: { templateId?: string; view?: string };
}) {
  const owner = await getCurrentPrismaUser();
  const publicAppUrl = getPublicAppUrl();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const view = announcementListView(searchParams?.view);
  const templateFilter = searchParams?.templateId ? { templateId: searchParams.templateId } : {};
  const announcements = await prisma.gLink.findMany({
    where: {
      ownerId: owner.id,
      status: view === "archived" ? "ARCHIVED" : { not: "ARCHIVED" },
      ...templateFilter,
    },
    orderBy: { createdAt: "desc" },
    include: {
      template: { select: { name: true, status: true, formTemplates: { select: { id: true }, take: 1 } } },
      templateVersion: { select: { version: true } },
      cases: { orderBy: { createdAt: "desc" }, select: { id: true, candidateEmail: true } },
    },
  });
  const archivedCount = await prisma.gLink.count({
    where: { ownerId: owner.id, status: "ARCHIVED", ...templateFilter },
  });
  const archivedJourneys = await prisma.relationTemplate.findMany({
    where: {
      status: "ARCHIVED",
      OR: [
        { generations: { some: { createdById: owner.id } } },
        { links: { some: { ownerId: owner.id } } },
      ],
      ...(searchParams?.templateId ? { id: searchParams.templateId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      formTemplates: { select: { id: true }, take: 1 },
      _count: { select: { links: true } },
    },
  });
  const totalArchivedCount = archivedCount + archivedJourneys.length;
  const statusCards = [
    { label: "Brouillons", value: await prisma.relationTemplate.count({ where: { status: "DRAFT" } }), href: "/parcours" },
    { label: "Publiées", value: announcements.filter((item) => item.status === "ACTIVE").length, href: "/opportunities" },
    { label: "Suspendues", value: announcements.filter((item) => item.status === "DISABLED").length, href: "/opportunities" },
    { label: "Clôturées", value: announcements.filter((item) => item.status === "EXPIRED").length, href: "/opportunities" },
    { label: "Archivées", value: totalArchivedCount, href: "/opportunities?view=archived" },
    { label: "Candidats détectés", value: announcements.reduce((sum, item) => sum + item.cases.length, 0), href: "/relations" },
    { label: "Demandes de mise en relation", value: await prisma.relationAction.count({ where: { relationCase: { ownerId: owner.id }, status: { not: "COMPLETED" } } }), href: "/relations" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Mes opportunités et relations</p>
          <h1 className="mt-2 text-3xl font-bold">Opportunités</h1>
          <ProductObjectDefinition object="announcement" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/opportunities/new" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Créer une opportunité</Link>
          <LogoutButton />
        </div>
      </div>
      <div className="mt-8"><PlatformNavigation active="opportunities" organizationName={organizationName} /></div>
      <ProductLifecycle current="announcement" />
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Vues des annonces">
        <Link href="/opportunities" aria-current={view === "active" ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === "active" ? "bg-slate-900 text-white" : "border bg-white text-slate-700"}`}>Annonces actives</Link>
        <Link href="/opportunities?view=archived" aria-current={view === "archived" ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === "archived" ? "bg-slate-900 text-white" : "border bg-white text-slate-700"}`}>Archives ({totalArchivedCount})</Link>
      </nav>
      <section className="mt-6 rounded-3xl border bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Créer et suivre vos opportunités</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Création assistée par IA, entrée vocale, aperçu enrichi, lien sécurisé, candidats détectés et demandes de mise en relation dans un parcours gouverné.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/opportunities/new#creation-options" className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Créer une opportunité</Link>
            {isDemoSurfaceEnabled() ? <Link href="/demo/housing-candidates" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">Démo · candidats détectés</Link> : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statusCards.map((card) => <Link key={card.label} href={card.href} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"><p className="text-sm text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-bold">{card.value}</p></Link>)}
        </div>
      </section>
      <div className="mt-6">
        {announcements.length || (view === "archived" && archivedJourneys.length) ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {announcements.map((item) => (
              <LinkCard key={item.id} publicAppUrl={publicAppUrl} item={{
                id: item.id,
                slug: item.slug,
                title: item.title,
                city: item.city,
                status: item.status,
                admissionMode: item.admissionMode,
                templateName: item.template?.name,
                templateStatus: item.template?.status,
                templateVersion: item.templateVersion?.version,
                archivedAt: item.archivedAt?.toISOString() ?? null,
                sourceJourneyHref: item.template?.formTemplates[0] ? `/templates/${item.template.formTemplates[0].id}` : undefined,
                cases: item.cases,
              }} />
            ))}
            {view === "archived" ? archivedJourneys.map((journey) => (
              <article key={journey.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{journey.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Parcours d'annonce archivé · {journey._count.links} annonce{journey._count.links > 1 ? "s" : ""} associée{journey._count.links > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    Archivée
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{journey.description ?? "Sans description"}</p>
                {journey.formTemplates[0] ? (
                  <Link href={`/templates/${journey.formTemplates[0].id}`} className="mt-4 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">
                    Voir l'élément archivé
                  </Link>
                ) : null}
              </article>
            )) : null}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
            <h2 className="font-semibold">{view === "archived" ? "Aucune annonce archivée" : "Aucune annonce active pour le moment"}</h2>
            <p className="mt-2 text-sm text-slate-500">{view === "archived" ? "Les annonces archivées resteront disponibles ici." : "Créez une annonce à partir d'un parcours validé."}</p>
          </div>
        )}
      </div>
    </main>
  );
}
