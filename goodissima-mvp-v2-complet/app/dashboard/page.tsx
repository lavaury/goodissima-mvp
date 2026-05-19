export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { DashboardLinkFilters } from "@/components/DashboardLinkFilters";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentPrismaUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

function formatRelativeDate(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) return `il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  if (diffHours >= 1) return `il y a ${diffHours}h`;

  return `il y a ${diffMinutes} min`;
}

export default async function DashboardPage() {
  noStore();

  const owner = await getCurrentPrismaUser();
  const [links, cases, recentCases, recentMessages, recentDocuments] = await Promise.all([
    prisma.gLink.findMany({
      where: { ownerId: owner.id },
      include: {
        cases: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            candidateEmail: true,
            priority: true,
            status: true,
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
    prisma.message.findMany({
      where: { relationCase: { ownerId: owner.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        senderType: true,
        createdAt: true,
        relationCase: {
          select: {
            id: true,
            gLink: { select: { title: true } },
          },
        },
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
    cases.filter((item) => item.status !== "CLOSED").map((item) => item.gLinkId),
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
  ];
  const dashboardLinks = links.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    city: item.city,
    cases: item.cases,
  }));
  const recentActivities = [
    ...recentCases.map((item) => ({
      id: `case-${item.id}`,
      caseId: item.id,
      label: t("dashboard.activity.newCase"),
      caseName: item.gLink.title,
      date: item.createdAt,
    })),
    ...recentMessages.map((item) => ({
      id: `message-${item.id}`,
      caseId: item.relationCase.id,
      label:
        item.senderType === "OWNER"
          ? t("dashboard.activity.ownerMessage")
          : t("dashboard.activity.candidateMessage"),
      caseName: item.relationCase.gLink.title,
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
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mb-8 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="font-semibold">{t("dashboard.recentActivity.title")}</h2>
        <div className="mt-3 divide-y">
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
                className="flex flex-col gap-1 py-3 text-sm hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
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
      <DashboardLinkFilters links={dashboardLinks} />
    </main>
  );
}
