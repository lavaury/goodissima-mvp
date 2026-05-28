import type { Prisma } from "@prisma/client";
import type { ConditionalRule } from "@/lib/form-rules";
import { prisma } from "@/lib/prisma";

export type TemplateSnapshotField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  defaultValue: string | null;
  step: number;
  options: Prisma.JsonValue;
  conditionalRules: Prisma.JsonValue;
  validationRules: Prisma.JsonValue;
};

export type TemplateSnapshot = {
  relationTemplate: {
    id: string;
    key: string;
    name: string;
    description: string | null;
  };
  formTemplate: {
    id: string;
    key: string;
    name: string;
    description: string | null;
  };
  fields: TemplateSnapshotField[];
  metadata: {
    snapshotVersion: 1;
  };
};

type FieldOption = {
  label: string;
  value: string;
};

function parseFieldOptions(options: unknown): FieldOption[] {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => {
      if (!option || typeof option !== "object") return null;

      const { label, value } = option as { label?: unknown; value?: unknown };
      if (typeof label !== "string" || typeof value !== "string") return null;

      return { label, value };
    })
    .filter((option): option is FieldOption => Boolean(option));
}

function parseConditionalRules(rules: unknown): ConditionalRule[] {
  if (!Array.isArray(rules)) return [];

  return rules
    .map((rule) => {
      if (!rule || typeof rule !== "object") return null;

      const { field, operator, value, action } = rule as Record<string, unknown>;
      if (typeof field !== "string" || typeof operator !== "string" || typeof action !== "string") {
        return null;
      }

      if (!["equals", "notEquals", "greaterThan", "exists"].includes(operator)) return null;
      if (!["SHOW", "HIDE", "REQUIRE", "DISABLE"].includes(action)) return null;

      return {
        field,
        operator,
        value: typeof value === "string" || typeof value === "boolean" || typeof value === "number" ? value : null,
        action,
      } as ConditionalRule;
    })
    .filter((rule): rule is ConditionalRule => Boolean(rule));
}

export async function buildTemplateSnapshot(formTemplateId: string): Promise<TemplateSnapshot | null> {
  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: formTemplateId },
    include: {
      relationTemplate: true,
      fields: { orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!formTemplate?.relationTemplate) return null;

  return {
    relationTemplate: {
      id: formTemplate.relationTemplate.id,
      key: formTemplate.relationTemplate.key,
      name: formTemplate.relationTemplate.name,
      description: formTemplate.relationTemplate.description,
    },
    formTemplate: {
      id: formTemplate.id,
      key: formTemplate.key,
      name: formTemplate.name,
      description: formTemplate.description,
    },
    fields: formTemplate.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type.toUpperCase(),
      required: field.required,
      placeholder: field.placeholder,
      defaultValue: field.defaultValue,
      step: field.step,
      options: field.options,
      conditionalRules: field.conditionalRules,
      validationRules: field.validationRules,
    })),
    metadata: {
      snapshotVersion: 1,
    },
  };
}

export function parseTemplateSnapshot(snapshot: Prisma.JsonValue): TemplateSnapshot | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;

  const value = snapshot as Record<string, unknown>;
  if (!Array.isArray(value.fields)) return null;

  const formTemplate = value.formTemplate as Record<string, unknown> | undefined;
  if (!formTemplate || typeof formTemplate.id !== "string") return null;

  return snapshot as TemplateSnapshot;
}

export function snapshotFieldsToDynamicFields(snapshot: TemplateSnapshot) {
  return snapshot.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type.toUpperCase(),
    required: field.required,
    placeholder: field.placeholder,
    defaultValue: field.defaultValue,
    step: field.step,
    options: parseFieldOptions(field.options),
    conditionalRules: parseConditionalRules(field.conditionalRules),
  }));
}

export async function getActiveTemplateVersion(templateId: string) {
  return prisma.templateVersion.findFirst({
    where: { templateId, isPublished: true },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
}
