export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { DEFAULT_RELATION_TEMPLATE_KEY } from "@/lib/relation-templates";
import { prisma } from "@/lib/prisma";
import {
  localizeTemplateFields,
  localizeTemplateName,
} from "@/lib/template-localization";
import { parseTemplateSnapshot, snapshotFieldsToDynamicFields } from "@/lib/template-snapshots";
import { formatConditionalRule } from "@/lib/template-readable";
import { NewLinkForm } from "./NewLinkForm";

export default async function NewLinkPage({ searchParams }: { searchParams?: { templateId?: string } }) {
  noStore();
  const { locale, t } = getI18n();
  await getCurrentPrismaUser();

  const templates = await prisma.relationTemplate.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      status: true,
      formTemplates: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          fields: {
            orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }],
            select: {
              key: true,
              label: true,
              type: true,
              required: true,
              placeholder: true,
              defaultValue: true,
              step: true,
              options: true,
              conditionalRules: true,
              validationRules: true,
            },
          },
        },
      },
      versions: {
        where: { isPublished: true },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { version: true, createdAt: true, snapshot: true },
      },
    },
  });
  const defaultTemplate = templates.find((template) => template.key === DEFAULT_RELATION_TEMPLATE_KEY);
  const templateOptions = templates.map((template) => {
    const activeVersion = template.versions[0] ?? null;
    const snapshot = activeVersion ? parseTemplateSnapshot(activeVersion.snapshot) : null;
    const rawFields = snapshot
      ? snapshotFieldsToDynamicFields(snapshot)
      : template.formTemplates[0]?.fields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type.toUpperCase(),
          required: field.required,
          placeholder: field.placeholder,
          defaultValue: field.defaultValue,
          step: field.step,
          options: Array.isArray(field.options) ? field.options as { label: string; value: string }[] : [],
          conditionalRules: Array.isArray(field.conditionalRules) ? field.conditionalRules as never[] : [],
          validationRules: field.validationRules,
        })) ?? [];
    const fields = localizeTemplateFields(template.key, rawFields, locale);
    const fieldLabels = fields.map((field) => ({ key: field.key, label: field.label }));
    const steps = Array.from(new Set(fields.map((field) => field.step || 1)))
      .sort((a, b) => a - b)
      .map((step) => ({
        step,
        fields: fields
          .filter((field) => (field.step || 1) === step)
          .map((field) => ({
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
          })),
      }));
    const rules = fields.flatMap((field) =>
      (field.conditionalRules ?? []).map((rule) => `${field.label}: ${formatConditionalRule(rule, fieldLabels)}`),
    );

    return {
      id: template.id,
      key: template.key,
      name: localizeTemplateName(template.key, template.name, locale),
      status: template.status,
      activeVersion: activeVersion
        ? { version: activeVersion.version, createdAt: activeVersion.createdAt.toISOString() }
        : null,
      steps,
      rules,
    };
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold">{t("links.new.title")}</h1>
      <NewLinkForm
        templates={templateOptions}
        defaultTemplateId={
          templateOptions.find((template) => template.id === searchParams?.templateId)?.id ??
          defaultTemplate?.id ??
          templateOptions[0]?.id ??
          null
        }
      />
    </main>
  );
}
