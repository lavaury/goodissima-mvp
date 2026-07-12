"use client";

import { VoiceCaptureButton } from "@/components/VoiceCaptureButton";
import type { ConditionalRule, FormValues } from "@/lib/form-rules";
import { isFieldDisabled, isFieldRequired, shouldDisplayField } from "@/lib/form-rules";
import { mergeVoiceTranscript } from "@/lib/voice-opportunity";
import { normalizePublicFormField } from "@/lib/candidate-form-safety";

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

function FieldLabel({ field, required }: { field: DynamicFormField; required: boolean }) {
  return (
    <span className="block text-sm font-medium text-slate-800">
      {field.label}
      {required ? (
        <span className="ml-1 text-red-600" aria-label="obligatoire">
          *
        </span>
      ) : null}
    </span>
  );
}

function FieldHelp({ placeholder }: { placeholder: string | null }) {
  if (!placeholder) return null;

  return <span className="mt-1 block text-xs text-slate-500">{placeholder}</span>;
}

function FieldShell({
  field,
  required,
  children,
}: {
  field: DynamicFormField;
  required: boolean;
  children: React.ReactNode;
}) {
  return (
    <label key={field.key} className="block space-y-2">
      <FieldLabel field={field} required={required} />
      {children}
      <FieldHelp placeholder={field.placeholder} />
    </label>
  );
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
  const safeFields = fields.map((field) => normalizePublicFormField(field));

  function renderField(field: DynamicFormField) {
    const fieldType = normalizeFieldType(field.type);
    if (!supportedFieldTypes.has(fieldType)) return null;
    if (!shouldDisplayField(field, ruleValues)) return null;

    const disabled = loading || isFieldDisabled(field, ruleValues);
    const required = isFieldRequired(field, ruleValues);

    switch (fieldType) {
      case "TEXTAREA":
        return (
          <div key={field.key} className="block space-y-2">
            <FieldLabel field={field} required={required} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <textarea
                className="min-h-32 w-full rounded-xl border px-4 py-3"
                placeholder={field.placeholder ?? undefined}
                value={getStringFieldValue(values[field.key])}
                required={required}
                disabled={disabled}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
              <VoiceCaptureButton
                label="Dicter ma réponse"
                disabled={disabled}
                onTranscript={(transcript) => {
                  onChange(field.key, mergeVoiceTranscript(getStringFieldValue(values[field.key]), transcript));
                }}
              />
            </div>
            <FieldHelp placeholder={field.placeholder} />
          </div>
        );
      case "SELECT":
        return (
          <FieldShell key={field.key} field={field} required={required}>
            <select
              className="w-full rounded-xl border px-4 py-3"
              value={getStringFieldValue(values[field.key])}
              required={required}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.value)}
            >
              <option value="">{field.placeholder || "Selectionner une option"}</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldShell>
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
            <span className="text-sm text-slate-700">
              {field.label}
              {required ? (
                <span className="ml-1 text-red-600" aria-label="obligatoire">
                  *
                </span>
              ) : null}
              <FieldHelp placeholder={field.placeholder} />
            </span>
          </label>
        );
      case "FILE":
        return (
          <div key={field.key} className="rounded-xl border px-4 py-3">
            <FieldLabel field={field} required={required} />
            <FieldHelp placeholder={field.placeholder} />
            <input
              className="mt-3 w-full text-sm"
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
          <FieldShell key={field.key} field={field} required={required}>
            <input
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
          </FieldShell>
        );
    }
  }

  return <>{safeFields.map(renderField)}</>;
}
