export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { LogoutButton } from "@/components/LogoutButton";
import { NewTemplateButton } from "@/components/NewTemplateButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { localizeTemplateDescription, localizeTemplateName } from "@/lib/template-localization";

function statusClasses(status: string) {
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "ARCHIVED") return "bg-slate-100 text-slate-600 ring-slate-200";

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function statusLabel(status: string, t: (key: string) => string) {
  if (status === "PUBLISHED") return t("studio.status.published");
  if (status === "ARCHIVED") return t("studio.status.archived");
  return t("studio.status.draft");
}

export default async function TemplatesPage() {
  noStore();
  const { locale, t } = getI18n();
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  const templates = await prisma.formTemplate.findMany({
    include: {
      _count: { select: { fields: true } },
      relationTemplate: {
        include: {
          _count: { select: { links: true } },
          versions: { where: { isPublished: true }, orderBy: { version: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <DashboardBackLink className="mb-4" />
          <h1 className="text-3xl font-bold">{t("studio.title")}</h1>
          <p className="text-slate-500">{t("studio.subtitle")}</p>
        </div>
        <LogoutButton />
      </div>
      <div className="mt-8">
        <PlatformNavigation active="studio" organizationName={organizationName} />
      </div>
      <div className="mt-6">
        <NewTemplateButton />
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border bg-white">
        {templates.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-slate-800">{t("studio.empty.title")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("studio.empty.body")}</p>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="grid gap-3 border-b p-5 lg:grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_1fr_auto] lg:items-center"
            >
              <div>
                <p className="font-semibold">
                  {localizeTemplateName(template.relationTemplate?.key, template.name, locale)}
                </p>
                <p className="font-mono text-xs text-slate-500">{template.key}</p>
              </div>
              <p className="text-sm text-slate-600">
                {localizeTemplateDescription(template.relationTemplate?.key, template.description, locale) ??
                  "Sans description"}
              </p>
              <div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(
                    template.relationTemplate?.status ?? "DRAFT",
                  )}`}
                >
                  {statusLabel(template.relationTemplate?.status ?? "DRAFT", t)}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {template.relationTemplate?.versions[0]
                  ? t("studio.activeVersion", { version: template.relationTemplate.versions[0].version })
                  : t("studio.noActiveVersion")}
              </p>
              <p className="text-sm text-slate-500">
                {t("studio.links", { count: template.relationTemplate?._count.links ?? 0 })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/templates/${template.id}`}
                  className="rounded-xl border px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {t("studio.test")}
                </Link>
                {template.relationTemplate ? (
                  <Link
                    href={`/links/new?templateId=${template.relationTemplate.id}`}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    {t("studio.createLinkWithJourney")}
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
