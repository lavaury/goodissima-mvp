export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
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

function formatDuration(minutes: number | null) {
  if (minutes === null) return "Non disponible";
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;

  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

function percent(value: number, base: number) {
  if (base === 0) return 0;
  return Math.round((value / base) * 100);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    NEW: "Nouveau",
    WAITING_CANDIDATE: "En attente candidat",
    WAITING_OWNER: "En attente equipe",
    REVIEWING: "En revue",
    VALIDATED: "Valide",
    REJECTED: "Rejete",
    CLOSED: "Finalise",
    ARCHIVED: "Archive",
  };

  return labels[status] ?? status;
}

export default async function AnalyticsPage() {
  noStore();

  const { t } = getI18n();
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";
  const links = await prisma.gLink.findMany({
    where: { ownerId: owner.id },
    orderBy: { createdAt: "desc" },
    include: {
      template: { select: { id: true, name: true } },
      cases: {
        orderBy: { createdAt: "desc" },
        include: {
          documents: { orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true } },
          messages: { orderBy: { createdAt: "asc" }, select: { id: true, senderType: true, createdAt: true } },
          relationActions: {
            orderBy: { createdAt: "desc" },
            select: { id: true, type: true, title: true, status: true, createdAt: true, completedAt: true },
          },
          formSubmissions: { select: { id: true, createdAt: true } },
        },
      },
    },
  });

  const cases = links.flatMap((link) => link.cases.map((relationCase) => ({ ...relationCase, link })));
  const documents = cases.flatMap((relationCase) =>
    relationCase.documents.map((document) => ({ ...document, relationCase })),
  );
  const messages = cases.flatMap((relationCase) =>
    relationCase.messages.map((message) => ({ ...message, relationCase })),
  );
  const actions = cases.flatMap((relationCase) =>
    relationCase.relationActions.map((action) => ({ ...action, relationCase })),
  );
  const openActions = actions.filter((action) => action.status !== "COMPLETED");
  const completedActions = actions.filter((action) => action.status === "COMPLETED" && action.completedAt);
  const finalizedCases = cases.filter((relationCase) => ["VALIDATED", "CLOSED", "ARCHIVED"].includes(relationCase.status));
  const activeRelations = cases.filter((relationCase) => !["CLOSED", "ARCHIVED"].includes(relationCase.status)).length;
  const newCases = cases.filter((relationCase) => Date.now() - relationCase.createdAt.getTime() <= 7 * 24 * 60 * 60000).length;
  const responseTimes = cases.flatMap((relationCase) => {
    const candidateMessage = relationCase.messages.find((message) => message.senderType === "CANDIDATE");
    if (!candidateMessage) return [];
    const ownerReply = relationCase.messages.find(
      (message) => message.senderType === "OWNER" && message.createdAt.getTime() > candidateMessage.createdAt.getTime(),
    );

    return ownerReply ? [(ownerReply.createdAt.getTime() - candidateMessage.createdAt.getTime()) / 60000] : [];
  });
  const averageResponseMinutes = average(responseTimes);

  const funnel = [
    { label: t("analytics.funnel.linkCreated"), value: links.length },
    { label: t("analytics.funnel.linkOpened"), value: cases.length },
    { label: t("analytics.funnel.formStarted"), value: cases.filter((item) => item.formSubmissions.length > 0).length },
    { label: t("analytics.funnel.documentsSent"), value: new Set(documents.map((document) => document.relationCase.id)).size },
    {
      label: t("analytics.funnel.validation"),
      value: cases.filter((item) => item.status === "VALIDATED" || item.relationActions.some((action) => action.status === "COMPLETED")).length,
    },
    { label: t("analytics.funnel.finalization"), value: finalizedCases.length },
  ];
  const funnelBase = Math.max(links.length, 1);
  const templates = new Map<
    string,
    {
      name: string;
      links: typeof links;
      cases: typeof cases;
      actions: typeof actions;
    }
  >();

  links.forEach((link) => {
    const id = link.template?.id ?? "sans-parcours";
    const existing = templates.get(id) ?? { name: link.template?.name ?? t("studio.noActiveVersion"), links: [], cases: [], actions: [] };
    existing.links.push(link);
    existing.cases.push(...cases.filter((relationCase) => relationCase.link.id === link.id));
    existing.actions.push(...actions.filter((action) => action.relationCase.link.id === link.id));
    templates.set(id, existing);
  });

  const performance = Array.from(templates.values())
    .map((template) => {
      const caseDurations = template.cases
        .filter((relationCase) => relationCase.closedAt)
        .map((relationCase) => (relationCase.closedAt!.getTime() - relationCase.createdAt.getTime()) / 60000);
      const converted = template.cases.filter((relationCase) => ["VALIDATED", "CLOSED"].includes(relationCase.status)).length;

      return {
        name: template.name,
        uses: template.links.length,
        conversion: percent(converted, template.cases.length),
        averageTime: formatDuration(average(caseDurations)),
        openActions: template.actions.filter((action) => action.status !== "COMPLETED").length,
      };
    })
    .sort((a, b) => b.uses - a.uses);

  const timeline = [
    ...documents.map((document) => ({
      id: `document-${document.id}`,
      label: t("analytics.activity.newDocument"),
      detail: document.relationCase.link.title,
      date: document.createdAt,
      badge: "Document",
    })),
    ...completedActions.map((action) => ({
      id: `action-${action.id}`,
      label: t("analytics.activity.completedAction"),
      detail: action.title,
      date: action.completedAt!,
      badge: "Validation",
    })),
    ...cases
      .filter((relationCase) => relationCase.status === "VALIDATED")
      .map((relationCase) => ({
        id: `validation-${relationCase.id}`,
        label: "Validation",
        detail: relationCase.link.title,
        date: relationCase.createdAt,
        badge: statusLabel(relationCase.status),
      })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 12);

  const kpis = [
    { label: t("analytics.global.activeRelations"), value: activeRelations, help: t("analytics.global.activeRelationsHelp"), icon: "↗" },
    { label: t("analytics.global.newCases"), value: newCases, help: t("analytics.global.newCasesHelp"), icon: "+" },
    { label: t("analytics.global.openRequests"), value: openActions.length, help: t("analytics.global.openRequestsHelp"), icon: "!" },
    { label: t("analytics.global.documents"), value: documents.length, help: t("analytics.global.documentsHelp"), icon: "□" },
    { label: t("analytics.global.avgResponse"), value: formatDuration(averageResponseMinutes), help: t("analytics.global.avgResponseHelp"), icon: "⏱" },
    { label: t("analytics.global.finalized"), value: finalizedCases.length, help: t("analytics.global.finalizedHelp"), icon: "✓" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <DashboardBackLink className="mb-4" />
          <h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
          <p className="mt-1 text-slate-500">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/templates" className="rounded-2xl border px-5 py-3 text-sm font-medium text-slate-700">
            {t("analytics.optimize")}
          </Link>
          <LogoutButton />
        </div>
      </div>

      <PlatformNavigation active="analytics" organizationName={organizationName} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
                {kpi.icon}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-950">{kpi.value}</p>
            <p className="mt-2 text-sm text-slate-500">{kpi.help}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("analytics.funnel.title")}</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              Pret pour demo
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {funnel.map((step, index) => (
              <div key={step.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">{index + 1}. {step.label}</span>
                  <span className="text-slate-500">{step.value} · {percent(step.value, funnelBase)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(5, percent(step.value, funnelBase))}%` }} />
                </div>
              </div>
            ))}
          </div>
          {links.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              {t("analytics.funnel.empty")}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{t("analytics.activity.title")}</h2>
          <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-2">
            {timeline.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                {t("analytics.activity.empty")}
              </p>
            ) : (
              timeline.map((event) => (
                <div key={event.id} className="flex gap-3 rounded-xl border p-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{event.label}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {event.badge}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">{event.detail}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-400">{formatRelativeDate(event.date)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{t("analytics.performance.title")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("analytics.performance.subtitle")}</p>
          </div>
          <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {performance.length} parcours
          </span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">{t("analytics.performance.journey")}</th>
                <th className="py-2">{t("analytics.performance.uses")}</th>
                <th className="py-2">{t("analytics.performance.conversion")}</th>
                <th className="py-2">{t("analytics.performance.avgTime")}</th>
                <th className="py-2">{t("analytics.performance.openActions")}</th>
              </tr>
            </thead>
            <tbody>
              {performance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border-t py-5 text-center text-slate-500">
                    {t("analytics.performance.empty")}
                  </td>
                </tr>
              ) : (
                performance.map((row) => (
                  <tr key={row.name} className="border-t">
                    <td className="py-4 font-medium text-slate-900">{row.name}</td>
                    <td className="py-4">{row.uses}</td>
                    <td className="py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        {row.conversion}%
                      </span>
                    </td>
                    <td className="py-4">{row.averageTime}</td>
                    <td className="py-4">{row.openActions}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
