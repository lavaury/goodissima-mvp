export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ChampagneDashboardCard } from "@/components/ChampagneDashboardCard";
import { DashboardLinkFilters } from "@/components/DashboardLinkFilters";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { canAccessChampagneWorkspace } from "@/lib/champagne-workspace";
import { getCurrentPrismaUser } from "@/lib/auth";
import { isGoodissimaDebugMode } from "@/lib/debug";
import { getI18n } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { DashboardRealtimeRefresh } from "./DashboardRealtimeRefresh";

type LinkAdmissionMode = "OPEN" | "VERIFIED_ONLY";

const VERIFIED_IDENTITY = "VERIFIED_IDENTITY";
const legacyJourneyMetricLabel = "Templates/parcours actifs";
void legacyJourneyMetricLabel;

function formatRelativeDate(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) return `il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  if (diffHours >= 1) return `il y a ${diffHours}h`;

  return `il y a ${diffMinutes} min`;
}

function getCaseLastActivityAt(relationCase: {
  createdAt: Date;
  messages: Array<{ createdAt: Date }>;
  documents: Array<{ createdAt: Date }>;
  relationActions: Array<{ createdAt: Date; completedAt: Date | null }>;
}) {
  return Math.max(
    relationCase.createdAt.getTime(),
    relationCase.messages[0]?.createdAt.getTime() ?? 0,
    relationCase.documents[0]?.createdAt.getTime() ?? 0,
    relationCase.relationActions[0]?.completedAt?.getTime() ??
      relationCase.relationActions[0]?.createdAt.getTime() ??
      0,
  );
}

function getAdmissionMode(
  trustPolicy:
    | {
        credentialRequirements: Array<{
          credentialType: {
            code: string;
          };
        }>;
      }
    | null
    | undefined,
): LinkAdmissionMode {
  return trustPolicy?.credentialRequirements.some(
    (requirement) => requirement.credentialType.code === VERIFIED_IDENTITY,
  )
    ? "VERIFIED_ONLY"
    : "OPEN";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { refresh?: string };
}) {
  noStore();
  const refreshKey = searchParams?.refresh;
  void refreshKey;

  const { t } = getI18n();
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const showChampagneScenarios = canAccessChampagneWorkspace(owner.role);
  const debugMode = isGoodissimaDebugMode();
  const showAdmissionPanel =
    process.env.TRUST_ADMISSION_VERIFIED_LINK_UI_ENABLED === "true";
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const trustAdmissionPilotGLinkIds = new Set(
    (process.env.TRUST_ADMISSION_PILOT_GLINK_IDS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const [links, cases, recentCases, recentDocuments, activeJourneyCount, publishedAnnouncementCount, ongoingRelationCount, draftOpportunityCount, pendingRelationCount, openActionCount, monthlyAIEvents, generatedTemplateCount, validatedTemplateCount, optimizedVersionCount] = await Promise.all([
    prisma.gLink.findMany({
      where: { ownerId: owner.id },
      include: {
        template: { select: { name: true, status: true } },
        templateVersion: { select: { version: true } },
        trustPolicies: {
          where: {
            scope: "GLINK",
            status: "ACTIVE",
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            credentialRequirements: {
              select: {
                credentialType: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        },
        cases: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            candidateEmail: true,
            candidateEmailNotificationsEnabled: true,
            priority: true,
            status: true,
            createdAt: true,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
            documents: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
            relationActions: {
              orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
              select: { status: true, createdAt: true, completedAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.relationCase.findMany({
      where: { ownerId: owner.id },
      select: {
        gLinkId: true,
        priority: true,
        status: true,
        relationActions: { select: { status: true } },
      },
    }),
    prisma.relationCase.findMany({
      where: { ownerId: owner.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        gLink: { select: { title: true } },
      },
    }),
    prisma.document.findMany({
      where: { relationCase: { ownerId: owner.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        uploadedByEmail: true,
        createdAt: true,
        relationCase: {
          select: {
            id: true,
            candidateEmail: true,
            gLink: { select: { title: true } },
          },
        },
      },
    }),
    prisma.relationTemplate.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.gLink.count({ where: { ownerId: owner.id, status: "ACTIVE" } }),
    prisma.relationCase.count({ where: { ownerId: owner.id, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
    prisma.relationTemplate.count({ where: { status: "DRAFT" } }),
    prisma.relationCase.count({ where: { ownerId: owner.id, status: { in: ["NEW", "WAITING_CANDIDATE", "WAITING_OWNER", "REVIEWING"] } } }),
    prisma.relationAction.count({ where: { relationCase: { ownerId: owner.id }, status: { not: "COMPLETED" } } }),
    prisma.aIEvent.findMany({ where: { organizationId: owner.id, createdAt: { gte: monthStart } }, select: { estimatedCostEur: true } }),
    prisma.templateGeneration.count({ where: { createdById: owner.id, createdAt: { gte: monthStart } } }),
    prisma.templateGeneration.count({ where: { createdById: owner.id, status: "VALIDATED", validatedAt: { gte: monthStart } } }),
    prisma.templateOptimization.count({ where: { approvedAt: { gte: monthStart } } }),
  ]);
  const monthlyAICost = monthlyAIEvents.reduce((sum, event) => sum + Number(event.estimatedCostEur ?? 0), 0);
  const estimatedValue = Math.round((validatedTemplateCount * 120) + (optimizedVersionCount * 80) + (publishedAnnouncementCount * 25));
  const activeLinkIds = new Set(
    cases
      .filter((item) => item.status !== "CLOSED" && item.status !== "ARCHIVED")
      .map((item) => item.gLinkId),
  );
  const stats = [
    { label: "Opportunités actives", value: links.filter((item) => item.status === "ACTIVE").length, href: "/opportunities" },
    { label: "Annonces publiées", value: publishedAnnouncementCount, href: "/opportunities" },
    { label: "Mises en relation en attente", value: pendingRelationCount, href: "/relations" },
    { label: "Relations en cours", value: ongoingRelationCount, href: "/relations" },
    { label: "Parcours actifs", value: activeJourneyCount, href: "/parcours" },
    { label: "Coût IA du mois", value: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 4 }).format(monthlyAICost), href: "/ia-valeur" },
    { label: "Valeur estimée", value: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(estimatedValue), href: "/ia-valeur" },
    { label: "Alertes ou actions ouvertes", value: openActionCount, href: "/relations" },
    { label: "Brouillons d'opportunités", value: draftOpportunityCount, href: "/parcours" },
    { label: t("dashboard.kpi.linksCreated"), value: links.length, href: "/opportunities" },
    { label: t("dashboard.kpi.activeCases"), value: activeLinkIds.size, href: "/relations" },
    { label: t("dashboard.kpi.waitingContact"), value: links.length - activeLinkIds.size, href: "/opportunities" },
    {
      label: t("dashboard.kpi.highPriority"),
      value: cases.filter((item) => item.priority === "HIGH").length,
      href: "/relations",
    },
    { label: t("dashboard.kpi.urgent"), value: cases.filter((item) => item.priority === "URGENT").length, href: "/relations" },
    { label: t("dashboard.kpi.closed"), value: cases.filter((item) => item.status === "CLOSED").length, href: "/relations" },
    { label: t("dashboard.kpi.archives"), value: cases.filter((item) => item.status === "ARCHIVED").length, href: "/relations" },
    {
      label: t("dashboard.kpi.openRequests"),
      value: cases.reduce(
        (count, item) => count + item.relationActions.filter((action) => action.status !== "COMPLETED").length,
        0,
      ),
      href: "/relations",
    },
  ];
  const dashboardLinks = links.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    city: item.city,
    templateName: item.template?.name ?? null,
    templateStatus: item.template?.status ?? null,
    templateVersion: item.templateVersion?.version ?? null,
    isTrustAdmissionPilot: trustAdmissionPilotGLinkIds.has(item.id),
    admissionMode: getAdmissionMode(item.trustPolicies[0]),
    openActionCount: item.cases.reduce(
      (count, relationCase) =>
        count + relationCase.relationActions.filter((action) => action.status !== "COMPLETED").length,
      0,
    ),
    cases: item.cases
      .map((relationCase) => ({
        id: relationCase.id,
        candidateEmail: relationCase.candidateEmailNotificationsEnabled || relationCase.candidateEmail.endsWith("@goodissima.local")
          ? t("dashboard.privateNotificationChannel")
          : relationCase.candidateEmail,
        priority: relationCase.priority,
        status: relationCase.status,
        lastActivityAt: getCaseLastActivityAt(relationCase),
      }))
      .sort((a, b) => {
        if (a.status === "ARCHIVED" && b.status !== "ARCHIVED") return 1;
        if (a.status !== "ARCHIVED" && b.status === "ARCHIVED") return -1;

        return b.lastActivityAt - a.lastActivityAt;
      }),
  }));
  const recentActivities = [
    ...recentCases.map((item) => ({
      id: `case-${item.id}`,
      caseId: item.id,
      label: t("dashboard.activity.newCase"),
      caseName: item.gLink.title,
      date: item.createdAt,
    })),
    ...recentDocuments.map((item) => ({
      id: `document-${item.id}`,
      caseId: item.relationCase.id,
      label:
        item.uploadedByEmail === item.relationCase.candidateEmail
          ? t("dashboard.activity.candidateDocument")
          : t("dashboard.activity.ownerDocument"),
      caseName: item.relationCase.gLink.title,
      date: item.createdAt,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <DashboardRealtimeRefresh />
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-slate-500">
            {t("dashboard.account")} {owner.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/opportunities/new" className="rounded-2xl bg-slate-900 px-5 py-3 text-white">
            {t("dashboard.createLink")}
          </Link>
          <LogoutButton />
        </div>
      </div>
      <PlatformNavigation active="dashboard" organizationName={organizationName} />
      <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Vue exécutive</p>
            <h2 className="mt-1 text-2xl font-bold">Piloter opportunités, parcours, relations et valeur</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">Une synthèse opérationnelle sans exposer les détails internes de Merge, CIRO, Trust ou des moteurs IA.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/opportunities/new" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Créer une opportunité</Link>
            <Link href="/opportunities/new#creation-options" className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700">Choisir : IA ou manuel</Link>
            <Link href="/ia-valeur" className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900">Voir la valeur IA</Link>
          </div>
        </div>
      </section>
      {showChampagneScenarios ? <ChampagneDashboardCard /> : null}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link href={stat.href} key={stat.label} className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
          </Link>
        ))}
      </div>
      <div className="mb-8 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("dashboard.recentActivity.title")}</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{t("common.live")}</span>
        </div>
        <div className="mt-3 max-h-80 divide-y overflow-y-auto pr-2">
          {recentActivities.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">
              {t("dashboard.recentActivity.empty")}
            </p>
          ) : (
            recentActivities.map((activity) => (
              <Link
                key={activity.id}
                href={`/cases/${activity.caseId}?refresh=1`}
                prefetch={false}
                className="flex flex-col gap-1 rounded-xl px-3 py-3 text-sm transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-slate-800">
                  {activity.label} — {activity.caseName}
                </span>
                <span className="text-xs text-slate-500">{formatRelativeDate(activity.date)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
      <DashboardLinkFilters
        links={dashboardLinks}
        debugMode={debugMode}
        showAdmissionPanel={showAdmissionPanel}
      />
    </main>
  );
}
