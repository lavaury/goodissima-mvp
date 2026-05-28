"use client";

import type { ConditionalRule, FormValues } from "@/lib/form-rules";
import { isFieldDisabled, isFieldRequired, shouldDisplayField } from "@/lib/form-rules";

export type DynamicFieldValue = string | boolean;

export type DynamicFieldOption = {
  label: string;
  value: string;
};

export type DynamicFormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  defaultValue: string | null;
  step: number;
  options: DynamicFieldOption[];
  conditionalRules: ConditionalRule[];
  validationRules?: unknown;
};

export const supportedFieldTypes = new Set([
  "TEXT",
  "EMAIL",
  "TEXTAREA",
  "PHONE",
  "NUMBER",
  "DATE",
  "SELECT",
  "CHECKBOX",
  "FILE",
]);

export function createInitialDynamicValues(fields: DynamicFormField[]) {
  return fields.reduce<Record<string, DynamicFieldValue>>((answers, field) => {
    answers[field.key] =
      field.type === "CHECKBOX" ? field.defaultValue === "true" : field.defaultValue ?? "";
    return answers;
  }, {});
}

export function getStringFieldValue(value: DynamicFieldValue | undefined) {
  return typeof value === "string" ? value : "";
}

export function toRuleValues(values: Record<string, DynamicFieldValue>): FormValues {
  return values;
}

export function normalizeFieldType(type: string) {
  return type.toUpperCase();
}

export function DynamicFormRenderer({
  fields,
  values,
  files = {},
  loading = false,
  onChange,
  onFileChange,
}: {
  fields: DynamicFormField[];
  values: Record<string, DynamicFieldValue>;
  files?: Record<string, File | null>;
  loading?: boolean;
  onChange: (key: string, value: DynamicFieldValue) => void;
  onFileChange?: (key: string, file: File | null) => void;
}) {
  const ruleValues = toRuleValues(values);

  function renderField(field: DynamicFormField) {
    const fieldType = normalizeFieldType(field.type);
    if (!supportedFieldTypes.has(fieldType)) return null;
    if (!shouldDisplayField(field, ruleValues)) return null;

    const disabled = loading || isFieldDisabled(field, ruleValues);
    const required = isFieldRequired(field, ruleValues);

    switch (fieldType) {
      case "TEXTAREA":
        return (
          <textarea
            key={field.key}
            className="min-h-32 w-full rounded-xl border px-4 py-3"
            placeholder={field.placeholder ?? undefined}
            value={getStringFieldValue(values[field.key])}
            required={required}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        );
      case "SELECT":
        return (
          <select
            key={field.key}
            className="w-full rounded-xl border px-4 py-3"
            value={getStringFieldValue(values[field.key])}
            required={required}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          >
            <option value="">{field.placeholder ?? field.label}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case "CHECKBOX":
        return (
          <label key={field.key} className="flex items-start gap-3 rounded-xl border px-4 py-3">
            <input
              className="mt-1"
              type="checkbox"
              checked={values[field.key] === true}
              required={required}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.checked)}
            />
            <span className="text-sm text-slate-700">{field.label}</span>
          </label>
        );
      case "FILE":
        return (
          <div key={field.key} className="rounded-xl border px-4 py-3">
            <p className="mb-2 text-sm font-medium">{field.label}</p>
            <input
              className="w-full text-sm"
              type="file"
              required={required}
              disabled={disabled}
              onChange={(e) => onFileChange?.(field.key, e.target.files?.[0] ?? null)}
            />
            {files[field.key] && <p className="mt-2 text-xs text-slate-500">{files[field.key]?.name}</p>}
          </div>
        );
      default:
        return (
          <input
            key={field.key}
            className="w-full rounded-xl border px-4 py-3"
              type={
              fieldType === "EMAIL"
                ? "email"
                : fieldType === "PHONE"
                  ? "tel"
                  : fieldType === "NUMBER"
                    ? "number"
                    : fieldType === "DATE"
                      ? "date"
                      : "text"
            }
            placeholder={field.placeholder ?? undefined}
            value={getStringFieldValue(values[field.key])}
            required={required}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        );
    }
  }

  return <>{fields.map(renderField)}</>;
}
