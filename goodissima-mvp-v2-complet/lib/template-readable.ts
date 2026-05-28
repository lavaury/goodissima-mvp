import type { ConditionalRule } from "@/lib/form-rules";

type FieldLabel = {
  key: string;
  label: string;
};

const operatorLabels: Record<string, string> = {
  equals: "est egal a",
  notEquals: "est different de",
  greaterThan: "est superieur a",
  exists: "existe",
};

const actionLabels: Record<string, string> = {
  SHOW: "afficher",
  HIDE: "masquer",
  REQUIRE: "rendre obligatoire",
  DISABLE: "desactiver",
};

function findFieldLabel(fieldKey: string, fields: FieldLabel[]) {
  return fields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
}

function formatRuleValue(rule: ConditionalRule) {
  if (rule.operator === "exists") return "";
  if (rule.value === null || rule.value === undefined || rule.value === "") return "vide";

  return String(rule.value);
}

export function formatConditionalRule(rule: ConditionalRule, fields: FieldLabel[] = []) {
  const field = findFieldLabel(rule.field, fields);
  const operator = operatorLabels[rule.operator] ?? rule.operator;
  const action = actionLabels[rule.action] ?? rule.action;
  const value = formatRuleValue(rule);
  const condition = value ? `${field} ${operator} ${value}` : `${field} ${operator}`;

  return `${action.charAt(0).toUpperCase()}${action.slice(1)} ce champ si ${condition}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return value as Record<string, unknown>;
}

function formatAllowedType(value: string) {
  return value.trim().toUpperCase();
}

export function formatValidationRules(value: unknown) {
  const rules = asObject(value);
  if (!rules) return [];

  const lines: string[] = [];
  const maxSizeMb = rules.maxSizeMb;
  const allowedTypes = rules.allowedTypes;

  if (typeof maxSizeMb === "number" || typeof maxSizeMb === "string") {
    lines.push(`Taille maximale : ${maxSizeMb} MB`);
  }

  if (Array.isArray(allowedTypes)) {
    const formattedTypes = allowedTypes
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map(formatAllowedType);

    if (formattedTypes.length > 0) {
      lines.push(`Formats autorises : ${formattedTypes.join(", ")}`);
    }
  }

  if (rules.min !== undefined) lines.push(`Valeur minimale : ${String(rules.min)}`);
  if (rules.max !== undefined) lines.push(`Valeur maximale : ${String(rules.max)}`);
  if (rules.pattern !== undefined) lines.push("Format specifique attendu");

  return lines;
}

export function formatOptions(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((option) => {
      const candidate = asObject(option);
      if (!candidate || typeof candidate.label !== "string") return null;

      return candidate.label;
    })
    .filter((label): label is string => Boolean(label));
}

export function parseReadableRules(value: unknown): ConditionalRule[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((rule) => {
      if (!rule || typeof rule !== "object") return null;

      const candidate = rule as Record<string, unknown>;
      if (
        typeof candidate.field !== "string" ||
        typeof candidate.operator !== "string" ||
        typeof candidate.action !== "string"
      ) {
        return null;
      }

      if (!["equals", "notEquals", "greaterThan", "exists"].includes(candidate.operator)) return null;
      if (!["SHOW", "HIDE", "REQUIRE", "DISABLE"].includes(candidate.action)) return null;

      return {
        field: candidate.field,
        operator: candidate.operator,
        value:
          typeof candidate.value === "string" ||
          typeof candidate.value === "number" ||
          typeof candidate.value === "boolean"
            ? candidate.value
            : null,
        action: candidate.action,
      } as ConditionalRule;
    })
    .filter((rule): rule is ConditionalRule => Boolean(rule));
}
