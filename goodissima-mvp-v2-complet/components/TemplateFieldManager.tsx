"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicFormPreview } from "@/components/DynamicFormPreview";
import { normalizeFieldType, type DynamicFormField } from "@/components/DynamicFormRenderer";
import { useToast } from "@/components/ToastProvider";
import type { ConditionalRule } from "@/lib/form-rules";

const fieldTypes = ["TEXT", "EMAIL", "TEXTAREA", "PHONE", "NUMBER", "DATE", "SELECT", "CHECKBOX", "FILE"];
const operators = ["equals", "notEquals", "greaterThan", "exists"];
const actions = ["SHOW", "HIDE", "REQUIRE", "DISABLE"];

type OptionItem = {
  label: string;
  value: string;
};

type RuleItem = {
  field: string;
  operator: string;
  value: string;
  action: string;
};

type EditableField = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  step: number;
  placeholder: string;
  optionsJson: string;
  conditionalRulesJson: string;
  validationRulesJson: string;
};

type BuilderField = Omit<EditableField, "optionsJson" | "conditionalRulesJson"> & {
  options: OptionItem[];
  rules: RuleItem[];
  fileAllowedTypes: string;
  fileMaxSizeMb: string;
};

type NewBuilderField = Omit<BuilderField, "id">;

const emptyField: NewBuilderField = {
  key: "",
  label: "",
  type: "TEXT",
  required: false,
  step: 1,
  placeholder: "",
  validationRulesJson: "",
  options: [],
  rules: [],
  fileAllowedTypes: "",
  fileMaxSizeMb: "",
};

function parseJson(value: string) {
  if (!value.trim()) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseOptions(value: string): OptionItem[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((option) => {
      if (!option || typeof option !== "object") return null;
      const { label, value } = option as Record<string, unknown>;
      if (typeof label !== "string" || typeof value !== "string") return null;
      return { label, value };
    })
    .filter((option): option is OptionItem => Boolean(option));
}

function parseRules(value: string): RuleItem[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((rule) => {
      if (!rule || typeof rule !== "object") return null;
      const { field, operator, value, action } = rule as Record<string, unknown>;
      if (typeof field !== "string" || typeof operator !== "string" || typeof action !== "string") {
        return null;
      }
      return {
        field,
        operator,
        value: typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "",
        action,
      };
    })
    .filter((rule): rule is RuleItem => Boolean(rule));
}

function parseFileRules(value: string) {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object") {
    return { fileAllowedTypes: "", fileMaxSizeMb: "" };
  }

  const rules = parsed as Record<string, unknown>;
  const allowedTypes = Array.isArray(rules.allowedTypes)
    ? rules.allowedTypes.filter((item): item is string => typeof item === "string").join(", ")
    : "";
  const maxSizeMb = typeof rules.maxSizeMb === "number" || typeof rules.maxSizeMb === "string" ? String(rules.maxSizeMb) : "";

  return { fileAllowedTypes: allowedTypes, fileMaxSizeMb: maxSizeMb };
}

function toBuilderField(field: EditableField): BuilderField {
  const fileRules = parseFileRules(field.validationRulesJson);

  return {
    id: field.id,
    key: field.key,
    label: field.label,
    type: normalizeFieldType(field.type),
    required: field.required,
    step: field.step,
    placeholder: field.placeholder,
    validationRulesJson: field.validationRulesJson,
    options: parseOptions(field.optionsJson),
    rules: parseRules(field.conditionalRulesJson),
    ...fileRules,
  };
}

function stringifyJson(value: unknown) {
  if (Array.isArray(value) && value.length === 0) return "";
  if (value && typeof value === "object" && Object.keys(value).length === 0) return "";

  return JSON.stringify(value, null, 2);
}

function serializeField(field: BuilderField | NewBuilderField) {
  const rules = field.rules
    .filter((rule) => rule.field && rule.operator && rule.action)
    .map((rule) => ({
      field: rule.field,
      operator: rule.operator,
      value: rule.operator === "exists" ? undefined : rule.value,
      action: rule.action,
    }));
  const fileRules =
    field.type === "FILE"
      ? {
          allowedTypes: field.fileAllowedTypes
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          maxSizeMb: field.fileMaxSizeMb ? Number(field.fileMaxSizeMb) : undefined,
        }
      : null;

  return {
    key: field.key,
    label: field.label,
    type: normalizeFieldType(field.type),
    required: field.required,
    step: field.step,
    placeholder: field.placeholder,
    optionsJson: field.type === "SELECT" ? stringifyJson(field.options.filter((option) => option.label && option.value)) : "",
    conditionalRulesJson: stringifyJson(rules),
    validationRulesJson: fileRules ? stringifyJson(fileRules) : field.validationRulesJson,
  };
}

function toPreviewField(field: BuilderField | NewBuilderField): DynamicFormField {
  const serialized = serializeField(field);
  const parsedRules = parseRules(serialized.conditionalRulesJson).map((rule) => ({
    field: rule.field,
    operator: rule.operator,
    value: rule.operator === "exists" ? null : rule.value,
    action: rule.action,
  })) as ConditionalRule[];

  return {
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    step: field.step,
    placeholder: field.placeholder || null,
    defaultValue: null,
    options: field.type === "SELECT" ? field.options.filter((option) => option.label && option.value) : [],
    conditionalRules: parsedRules,
    validationRules: parseJson(serialized.validationRulesJson),
  };
}

function buildStepNames(fields: Array<BuilderField | NewBuilderField>) {
  return fields.reduce<Record<number, string>>((result, field) => {
    result[field.step] = result[field.step] ?? `Etape ${field.step}`;
    return result;
  }, {});
}

async function getApiErrorMessage(res: Response) {
  try {
    const body = await res.json();
    return typeof body.error === "string" ? body.error : "Erreur lors de l'action";
  } catch {
    return "Erreur lors de l'action";
  }
}

export function TemplateFieldManager({
  templateId,
  fields,
}: {
  templateId: string;
  fields: EditableField[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [newField, setNewField] = useState<NewBuilderField>(emptyField);
  const [edits, setEdits] = useState<Record<string, BuilderField>>(() =>
    fields.reduce<Record<string, BuilderField>>((result, field) => {
      result[field.id] = toBuilderField(field);
      return result;
    }, {}),
  );
  const savedFields = fields.map((field) => edits[field.id] ?? toBuilderField(field));
  const previewSource = newField.key || newField.label ? [...savedFields, newField] : savedFields;
  const previewFields = previewSource.filter((field) => field.key && field.label).map(toPreviewField);
  const [stepNames, setStepNames] = useState<Record<number, string>>(() => buildStepNames(previewSource));
  const detectedSteps = useMemo(
    () => Array.from(new Set(previewSource.map((field) => field.step))).sort((a, b) => a - b),
    [previewSource],
  );

  async function submitNewField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);

    const res = await fetch(`/api/templates/${templateId}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeField(newField)),
    });

    setCreating(false);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res));
      return;
    }

    setNewField(emptyField);
    toast.success("Champ ajoute");
    router.refresh();
  }

  async function updateField(fieldId: string) {
    setSavingFieldId(fieldId);

    const res = await fetch(`/api/templates/fields/${fieldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeField(edits[fieldId])),
    });

    setSavingFieldId(null);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res));
      return;
    }

    toast.success("Champ modifie");
    router.refresh();
  }

  async function deleteField(fieldId: string) {
    setSavingFieldId(fieldId);

    const res = await fetch(`/api/templates/fields/${fieldId}`, {
      method: "DELETE",
    });

    setSavingFieldId(null);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res));
      return;
    }

    toast.success("Champ supprime");
    router.refresh();
  }

  function renderOptionsEditor<T extends BuilderField | NewBuilderField>(value: T, onChange: (next: T) => void) {
    if (value.type !== "SELECT") return null;

    return (
      <div className="rounded-xl border p-4 md:col-span-2">
        <p className="mb-3 text-sm font-medium">Options de selection</p>
        <div className="space-y-2">
          {value.options.map((option, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input
                className="rounded-xl border px-3 py-2"
                placeholder="Label"
                value={option.label}
                onChange={(e) => {
                  const options = [...value.options];
                  options[index] = { ...option, label: e.target.value };
                  onChange({ ...value, options });
                }}
              />
              <input
                className="rounded-xl border px-3 py-2"
                placeholder="Value"
                value={option.value}
                onChange={(e) => {
                  const options = [...value.options];
                  options[index] = { ...option, value: e.target.value };
                  onChange({ ...value, options });
                }}
              />
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => onChange({ ...value, options: value.options.filter((_, itemIndex) => itemIndex !== index) })}
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 rounded-xl border px-3 py-2 text-sm"
          onClick={() => onChange({ ...value, options: [...value.options, { label: "", value: "" }] })}
        >
          Ajouter une option
        </button>
      </div>
    );
  }

  function renderRuleBuilder<T extends BuilderField | NewBuilderField>(value: T, onChange: (next: T) => void) {
    return (
      <div className="rounded-xl border p-4 md:col-span-2">
        <p className="mb-3 text-sm font-medium">Regles conditionnelles</p>
        <div className="space-y-2">
          {value.rules.map((rule, index) => (
            <div key={index} className="grid gap-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <select
                className="rounded-xl border px-3 py-2"
                value={rule.field}
                onChange={(e) => {
                  const rules = [...value.rules];
                  rules[index] = { ...rule, field: e.target.value };
                  onChange({ ...value, rules });
                }}
              >
                <option value="">SI champ</option>
                {savedFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label || field.key}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border px-3 py-2"
                value={rule.operator}
                onChange={(e) => {
                  const rules = [...value.rules];
                  rules[index] = { ...rule, operator: e.target.value };
                  onChange({ ...value, rules });
                }}
              >
                {operators.map((operator) => (
                  <option key={operator} value={operator}>
                    {operator}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border px-3 py-2 disabled:bg-slate-50"
                placeholder="value"
                value={rule.value}
                disabled={rule.operator === "exists"}
                onChange={(e) => {
                  const rules = [...value.rules];
                  rules[index] = { ...rule, value: e.target.value };
                  onChange({ ...value, rules });
                }}
              />
              <select
                className="rounded-xl border px-3 py-2"
                value={rule.action}
                onChange={(e) => {
                  const rules = [...value.rules];
                  rules[index] = { ...rule, action: e.target.value };
                  onChange({ ...value, rules });
                }}
              >
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => onChange({ ...value, rules: value.rules.filter((_, itemIndex) => itemIndex !== index) })}
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 rounded-xl border px-3 py-2 text-sm"
          onClick={() =>
            onChange({
              ...value,
              rules: [...value.rules, { field: "", operator: "equals", value: "", action: "SHOW" }],
            })
          }
        >
          Ajouter une regle
        </button>
      </div>
    );
  }

  function renderFileEditor<T extends BuilderField | NewBuilderField>(value: T, onChange: (next: T) => void) {
    if (value.type !== "FILE") return null;

    return (
      <div className="grid gap-3 rounded-xl border p-4 md:col-span-2 md:grid-cols-2">
        <input
          className="rounded-xl border px-4 py-3"
          placeholder="Types autorises: pdf, jpg, png"
          value={value.fileAllowedTypes}
          onChange={(e) => onChange({ ...value, fileAllowedTypes: e.target.value })}
        />
        <input
          className="rounded-xl border px-4 py-3"
          min={1}
          type="number"
          placeholder="Taille max en Mo"
          value={value.fileMaxSizeMb}
          onChange={(e) => onChange({ ...value, fileMaxSizeMb: e.target.value })}
        />
      </div>
    );
  }

  function renderFieldInputs<T extends BuilderField | NewBuilderField>(value: T, onChange: (next: T) => void) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded-xl border px-4 py-3"
          placeholder="Identifiant technique"
          value={value.key}
          onChange={(e) => onChange({ ...value, key: e.target.value })}
        />
        <input
          className="rounded-xl border px-4 py-3"
          placeholder={value.type === "CHECKBOX" ? "Texte de consentement" : "Label visible"}
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
        />
        <select
          className="rounded-xl border px-4 py-3"
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value })}
        >
          {fieldTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border px-4 py-3"
          placeholder={value.type === "FILE" ? "Texte d'aide du fichier" : "Placeholder"}
          value={value.placeholder}
          onChange={(e) => onChange({ ...value, placeholder: e.target.value })}
        />
        <input
          className="rounded-xl border px-4 py-3"
          min={1}
          type="number"
          placeholder="Step"
          value={value.step}
          onChange={(e) => onChange({ ...value, step: Number(e.target.value) || 1 })}
        />
        <label className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={value.required}
            onChange={(e) => onChange({ ...value, required: e.target.checked })}
          />
          Required
        </label>
        {renderOptionsEditor(value, onChange)}
        {renderFileEditor(value, onChange)}
        {renderRuleBuilder(value, onChange)}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Nommer les etapes</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detectedSteps.map((step) => (
              <input
                key={step}
                className="rounded-xl border px-4 py-3"
                placeholder={`Etape ${step}`}
                value={stepNames[step] ?? ""}
                onChange={(e) => setStepNames({ ...stepNames, [step]: e.target.value })}
              />
            ))}
          </div>
        </div>

        <form onSubmit={submitNewField} className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Ajouter un champ</h2>
          <div className="mt-4">{renderFieldInputs(newField, setNewField)}</div>
          <button
            type="submit"
            disabled={creating}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {creating ? "Ajout..." : "Ajouter"}
          </button>
        </form>

        <div className="space-y-4">
          {savedFields.map((field) => (
            <div key={field.id} className="rounded-2xl border bg-white p-5">
              {renderFieldInputs(field, (next) => setEdits({ ...edits, [field.id]: next }))}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void updateField(field.id)}
                  disabled={savingFieldId === field.id}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => void deleteField(field.id)}
                  disabled={savingFieldId === field.id}
                  className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="rounded-2xl border bg-white p-5 lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-semibold">Preview live</h2>
        <div className="mt-4">
          <DynamicFormPreview fields={previewFields} stepNames={stepNames} />
        </div>
      </aside>
    </div>
  );
}
