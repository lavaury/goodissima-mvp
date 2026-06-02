export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { DashboardLinkFilters } from "@/components/DashboardLinkFilters";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { isGoodissimaDebugMode } from "@/lib/debug";
import { getI18n } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { DashboardRealtimeRefresh } from "./DashboardRealtimeRefresh";

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
  const debugMode = isGoodissimaDebugMode();
  const [links, cases, recentCases, recentDocuments] = await Promise.all([
    prisma.gLink.findMany({
      where: { ownerId: owner.id },
      include: {
        template: { select: { name: true, status: true } },
        templateVersion: { select: { version: true } },
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
  ]);
  const activeLinkIds = new Set(
    cases
      .filter((item) => item.status !== "CLOSED" && item.status !== "ARCHIVED")
      .map((item) => item.gLinkId),
  );
  const stats = [
    { label: t("dashboard.kpi.linksCreated"), value: links.length },
    { label: t("dashboard.kpi.activeCases"), value: activeLinkIds.size },
    { label: t("dashboard.kpi.waitingContact"), value: links.length - activeLinkIds.size },
    {
      label: t("dashboard.kpi.highPriority"),
      value: cases.filter((item) => item.priority === "HIGH").length,
    },
    { label: t("dashboard.kpi.urgent"), value: cases.filter((item) => item.priority === "URGENT").length },
    { label: t("dashboard.kpi.closed"), value: cases.filter((item) => item.status === "CLOSED").length },
    { label: t("dashboard.kpi.archives"), value: cases.filter((item) => item.status === "ARCHIVED").length },
    {
      label: t("dashboard.kpi.openRequests"),
      value: cases.reduce(
        (count, item) => count + item.relationActions.filter((action) => action.status !== "COMPLETED").length,
        0,
      ),
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
          <Link href="/links/new" className="rounded-2xl bg-slate-900 px-5 py-3 text-white">
            {t("dashboard.createLink")}
          </Link>
          <LogoutButton />
        </div>
      </div>
      <PlatformNavigation active="relations" organizationName={organizationName} />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
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
      <DashboardLinkFilters links={dashboardLinks} debugMode={debugMode} />
    </main>
  );
}
