import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import type { FormValue, FormValues } from "@/lib/form-rules";

export const DEFAULT_FORM_TEMPLATE_KEY = "DEFAULT_SECURE_CONVERSATION_FORM";

export function getFormTemplateByKey(key: string) {
  return prisma.formTemplate.findUnique({
    where: { key },
  });
}

export function getFormFields(formTemplateId: string) {
  return prisma.formField.findMany({
    where: { formTemplateId },
    orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
}

export function createFormSubmission({
  formTemplateId,
  caseId,
  answers,
}: {
  formTemplateId: string;
  caseId?: string | null;
  answers: Prisma.InputJsonValue;
}) {
  return prisma.formSubmission.create({
    data: {
      formTemplateId,
      caseId: caseId ?? null,
      answers,
    },
  });
}

export type HumanReadableFormField = {
  key: string;
  label: string;
  type?: string | null;
  options?: unknown;
};

export type HumanReadableFormAnswer = {
  fieldId: string;
  label: string;
  value: FormValue;
  formattedValue: string;
  type: string;
};

function normalizeFieldType(type: string | null | undefined) {
  return (type ?? "TEXT").toUpperCase();
}

function isEmptyAnswer(value: FormValue | undefined) {
  return value === undefined || value === null || value === "";
}

function optionLabel(options: unknown, value: FormValue) {
  if (!Array.isArray(options)) return null;

  const match = options.find((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) return false;
    return option.value === value;
  });

  if (!match || typeof match !== "object" || Array.isArray(match)) return null;
  return typeof match.label === "string" ? match.label : null;
}

function formatDateValue(value: FormValue) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatNumberValue(label: string, value: FormValue) {
  const numericValue = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  if (Number.isNaN(numericValue)) return String(value ?? "");

  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(numericValue);
  const normalizedLabel = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalizedLabel.includes("budget")) return `${formatted} €`;
  if (normalizedLabel.includes("surface")) return `${formatted} m²`;

  return formatted;
}

function formatArrayValue(options: unknown, value: FormValue[]): string {
  return value
    .map((item) => optionLabel(options, item) ?? formatFormAnswerValue({ label: "", type: "TEXT", options, value: item }))
    .filter(Boolean)
    .join(", ");
}

export function formatFormAnswerValue({
  label,
  type,
  options,
  value,
}: {
  label: string;
  type?: string | null;
  options?: unknown;
  value: FormValue;
}): string {
  if (isEmptyAnswer(value)) return "Non renseigné";

  const fieldType = normalizeFieldType(type);
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return formatArrayValue(options, value);
  if (fieldType === "SELECT") return optionLabel(options, value) ?? String(value);
  if (fieldType === "MULTISELECT" && typeof value === "string") {
    return value.split("\u001f").filter(Boolean).map((item) => optionLabel(options, item) ?? item).join(", ");
  }
  if (fieldType === "DATE") return formatDateValue(value) ?? String(value);
  if (fieldType === "NUMBER") return formatNumberValue(label, value);

  return String(value);
}

export function buildHumanReadableFormAnswers(
  fields: HumanReadableFormField[],
  answers: FormValues,
): HumanReadableFormAnswer[] {
  return fields
    .filter((field) => Object.prototype.hasOwnProperty.call(answers, field.key))
    .map((field) => {
      const value = answers[field.key];
      const type = normalizeFieldType(field.type);

      return {
        fieldId: field.key,
        label: field.label || field.key,
        value,
        formattedValue: formatFormAnswerValue({ label: field.label || field.key, type, options: field.options, value }),
        type,
      };
    });
}

export function buildHumanReadableFormMessage(fields: HumanReadableFormField[], answers: FormValues) {
  const entries = buildHumanReadableFormAnswers(fields, answers).filter((entry) => entry.formattedValue !== "Non renseigné");

  if (entries.length === 0) return "Réponse au formulaire candidat.";

  return ["Réponse au formulaire", "", ...entries.map((entry) => `${entry.label} : ${entry.formattedValue}`)].join("\n");
}
