export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ActiveOrganizationBadge } from "@/components/ActiveOrganizationBadge";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { PublishTemplateButton } from "@/components/PublishTemplateButton";
import { TemplateLifecycleActions } from "@/components/TemplateLifecycleActions";
import { TemplateFieldManager } from "@/components/TemplateFieldManager";
import { TemplateAIInstructionsEditor } from "@/components/TemplateAIInstructionsEditor";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { localizeTemplateDescription, localizeTemplateName } from "@/lib/template-localization";
import {
  formatConditionalRule,
  formatOptions,
  formatValidationRules,
  parseReadableRules,
} from "@/lib/template-readable";

function formatJson(value: unknown) {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClasses(status: string) {
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "ARCHIVED") return "bg-slate-100 text-slate-600 ring-slate-200";

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function statusLabel(status: string) {
  if (status === "PUBLISHED") return "Publie";
  if (status === "ARCHIVED") return "Archive";
  return "Brouillon";
}

function ReadableList({
  items,
  empty = "Aucune règle",
}: {
  items: string[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <span className="text-xs text-slate-500">{empty}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default async function TemplateDetailPage({ params }: { params: { templateId: string } }) {
  noStore();
  const { locale, t } = getI18n();
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  const template = await prisma.formTemplate.findUnique({
    where: { id: params.templateId },
    include: {
      relationTemplate: {
        include: {
          versions: { orderBy: { version: "desc" } },
          _count: { select: { links: true } },
        },
      },
      fields: { orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!template) notFound();

  const editableFields = template.fields.map((field) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    step: field.step,
    placeholder: field.placeholder ?? "",
    optionsJson: formatJson(field.options),
    conditionalRulesJson: formatJson(field.conditionalRules),
    validationRulesJson: formatJson(field.validationRules),
  }));
  const status = template.relationTemplate?.status ?? "DRAFT";
  const activeVersion = template.relationTemplate?.versions.find((version) => version.isPublished) ?? null;
  const lastVersion = template.relationTemplate?.versions[0] ?? null;
  const futureVersion = (lastVersion?.version ?? 0) + 1;
  const fieldLabels = template.fields.map((field) => ({ key: field.key, label: field.label }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <DashboardBackLink />
          <Link href="/templates" className="inline-flex min-h-10 items-center rounded-xl border px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900">
            {t("studio.back")}
          </Link>
        </div>
        <ActiveOrganizationBadge organizationName={organizationName} />
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase text-slate-500">{template.key}</p>
            <h1 className="mt-2 text-3xl font-bold">
              {localizeTemplateName(template.relationTemplate?.key, template.name, locale)}
            </h1>
            <p className="mt-3 text-slate-600">
              {localizeTemplateDescription(template.relationTemplate?.key, template.description, locale) ??
                "Sans description"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(status)}`}>
              {statusLabel(status)}
            </span>
            {template.relationTemplate ? (
              <Link
                href={`/links/new?templateId=${template.relationTemplate.id}`}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {t("studio.createLinkWithJourney")}
              </Link>
            ) : null}
            <TemplateLifecycleActions templateId={template.id} isArchived={status === "ARCHIVED"} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
          <p>
            <span className="text-slate-500">Parcours:</span>{" "}
            {template.relationTemplate?.key ?? "Aucun"}
          </p>
          <p>
            <span className="text-slate-500">Statut:</span>{" "}
            {statusLabel(template.relationTemplate?.status ?? "DRAFT")}
          </p>
          <p>
            <span className="text-slate-500">{t("studio.fields")}:</span> {template.fields.length}
          </p>
          <p>
            <span className="text-slate-500">Version active:</span>{" "}
            {activeVersion ? `v${activeVersion.version}` : "Aucune"}
          </p>
          <p>
            <span className="text-slate-500">Dernière publication:</span>{" "}
            {lastVersion ? formatDate(lastVersion.createdAt) : "Jamais"}
          </p>
          <p>
            <span className="text-slate-500">Liens:</span> {template.relationTemplate?._count.links ?? 0}
          </p>
        </div>
      </section>

      <TemplateAIInstructionsEditor
        templateId={template.id}
        initialValue={template.relationTemplate?.aiInstructions ?? ""}
        disabled={!template.relationTemplate}
      />

      <section className="mt-8 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold">Publication</h2>
            <p className="mt-2 text-sm text-slate-600">
              {"Cette publication créera une nouvelle version figée du parcours."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {"Les liens déjà créés continuent d'utiliser leur version publiée. Les nouveaux liens prendront la version active."}
            </p>
            <p className="mt-1 text-sm text-slate-500">Version future: v{futureVersion}</p>
          </div>
          <PublishTemplateButton templateId={template.id} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Champs</p>
            <p className="mt-2 text-2xl font-semibold">{template.fields.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Étapes</p>
            <p className="mt-2 text-2xl font-semibold">
              {new Set(template.fields.map((field) => field.step)).size || 1}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Règles</p>
            <p className="mt-2 text-2xl font-semibold">
              {template.fields.reduce((count, field) => count + parseReadableRules(field.conditionalRules).length, 0)}
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {template.fields.map((field) => {
            const rules = parseReadableRules(field.conditionalRules);
            const validations = formatValidationRules(field.validationRules);
            const options = formatOptions(field.options);

            return (
              <div key={field.id} className="rounded-xl border p-4 text-sm">
                <p className="font-medium">
                  {"Étape"} {field.step} - {field.label}{" "}
                  <span className="font-normal text-slate-500">({field.type})</span>
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Règles</p>
                    {rules.length > 0 ? (
                      <div className="space-y-1 text-slate-600">
                        {rules.map((rule, index) => (
                          <p key={`${field.id}-rule-${index}`}>{formatConditionalRule(rule, fieldLabels)}</p>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Aucune règle</span>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Validation</p>
                    <ReadableList items={validations} empty="Aucune validation" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Options</p>
                    <ReadableList items={options} empty="Aucune option" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Versions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Version</th>
                <th className="py-2">Active</th>
                <th className="py-2">Nom</th>
                <th className="py-2">Date publication</th>
              </tr>
            </thead>
            <tbody>
              {(template.relationTemplate?.versions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="border-t py-3 text-slate-500">
                    Aucune version publiée.
                  </td>
                </tr>
              ) : (
                template.relationTemplate?.versions.map((version) => (
                  <tr key={version.id} className="border-t">
                    <td className="py-3">v{version.version}</td>
                    <td className="py-3">{version.isPublished ? "Oui" : "Non"}</td>
                    <td className="py-3">{version.name}</td>
                    <td className="py-3">{formatDate(version.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">{t("studio.fields")}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Position</th>
                <th className="py-2">Étape</th>
                <th className="py-2">Cle</th>
                <th className="py-2">Libelle</th>
                <th className="py-2">Type</th>
                <th className="py-2">Obligatoire</th>
                <th className="py-2">Règles</th>
                <th className="py-2">Validation</th>
              </tr>
            </thead>
            <tbody>
              {template.fields.map((field) => (
                <tr key={field.id} className="border-t align-top">
                  <td className="py-3">{field.position}</td>
                  <td className="py-3">{field.step}</td>
                  <td className="py-3 font-mono text-xs">{field.key}</td>
                  <td className="py-3">{field.label}</td>
                  <td className="py-3">{field.type}</td>
                  <td className="py-3">{field.required ? "Oui" : "Non"}</td>
                  <td className="max-w-xs py-3">
                    {parseReadableRules(field.conditionalRules).length === 0 ? (
                      <span className="text-slate-500">Aucune règle</span>
                    ) : (
                      <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
                        {parseReadableRules(field.conditionalRules).map((rule, index) => (
                          <p key={`${field.id}-table-rule-${index}`}>{formatConditionalRule(rule, fieldLabels)}</p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="max-w-xs py-3">
                    <ReadableList items={formatValidationRules(field.validationRules)} empty="Aucune validation" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <TemplateFieldManager templateId={template.id} fields={editableFields} />
      </section>
    </main>
  );
}
