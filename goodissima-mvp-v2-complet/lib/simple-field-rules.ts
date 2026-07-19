export type SimpleRuleMode = "INDICATIVE" | "BLOCKING";
export type SimpleRuleOperator =
  | "NONE" | "LT" | "LTE" | "GT" | "GTE" | "BETWEEN"
  | "CONTAINS" | "MIN_LENGTH" | "MAX_LENGTH"
  | "EMAIL_FORMAT" | "PHONE_FORMAT"
  | "DATE_BEFORE" | "DATE_AFTER" | "DATE_BETWEEN"
  | "REQUIRED_OPTION" | "MAX_CHOICES"
  | "CITY_EXACT" | "CITY_RADIUS";

export type SimpleFieldRule = {
  operator: SimpleRuleOperator;
  mode: SimpleRuleMode;
  value?: string;
  value2?: string;
  city?: string;
  radiusKm?: number;
  declarative?: boolean;
};

export type SimpleRuleField = {
  label: string;
  validationRules?: unknown;
};

export function parseSimpleFieldRule(value: unknown): SimpleFieldRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const operator = typeof row.operator === "string" ? row.operator as SimpleRuleOperator : "NONE";
  if (operator === "NONE") return null;
  return {
    operator,
    mode: row.mode === "BLOCKING" ? "BLOCKING" : "INDICATIVE",
    value: typeof row.value === "string" ? row.value : undefined,
    value2: typeof row.value2 === "string" ? row.value2 : undefined,
    city: typeof row.city === "string" ? row.city : undefined,
    radiusKm: typeof row.radiusKm === "number" ? row.radiusKm : Number(row.radiusKm) || undefined,
    declarative: row.declarative === true || operator === "CITY_RADIUS",
  };
}

export function describeSimpleFieldRule(field: SimpleRuleField) {
  const rule = parseSimpleFieldRule(field.validationRules);
  if (!rule) return "";
  const amountField = /loyer|budget|prix|montant/i.test(field.label);
  const formatValue = (value?: string) => `${value ?? ""}${amountField && value ? " €" : ""}`;
  const v = formatValue(rule.value);
  const v2 = formatValue(rule.value2);
  const descriptions: Record<SimpleRuleOperator, string> = {
    NONE: "",
    LT: `doit être inférieur à ${v}`,
    LTE: `doit être inférieur ou égal à ${v}`,
    GT: `doit être supérieur à ${v}`,
    GTE: `doit être supérieur ou égal à ${v}`,
    BETWEEN: `doit être compris entre ${v} et ${v2}`,
    CONTAINS: `doit contenir « ${v} »`,
    MIN_LENGTH: `longueur minimale ${v} caractères`,
    MAX_LENGTH: `longueur maximale ${v} caractères`,
    EMAIL_FORMAT: "doit respecter le format email",
    PHONE_FORMAT: "doit respecter le format téléphone",
    DATE_BEFORE: `doit être avant le ${v}`,
    DATE_AFTER: `doit être après le ${v}`,
    DATE_BETWEEN: `doit être entre le ${v} et le ${v2}`,
    REQUIRED_OPTION: `doit inclure l’option « ${v} »`,
    MAX_CHOICES: `${v} choix maximum`,
    CITY_EXACT: `doit être ${rule.city || v}`,
    CITY_RADIUS: `critère déclaré : ${rule.city || v} + ${rule.radiusKm || v2} km, à vérifier humainement`,
  };
  return `${field.label} ${descriptions[rule.operator]}`;
}

export function evaluateSimpleFieldRule(value: unknown, ruleValue: unknown) {
  const rule = parseSimpleFieldRule(ruleValue);
  if (!rule) return { valid: true, rule: null };
  const text = typeof value === "string" ? value.trim() : String(value ?? "");
  const number = Number(text.replace(",", "."));
  const target = Number((rule.value ?? "").replace(",", "."));
  const target2 = Number((rule.value2 ?? "").replace(",", "."));
  let valid = true;
  switch (rule.operator) {
    case "LT": valid = number < target; break;
    case "LTE": valid = number <= target; break;
    case "GT": valid = number > target; break;
    case "GTE": valid = number >= target; break;
    case "BETWEEN": valid = number >= target && number <= target2; break;
    case "CONTAINS": valid = text.toLocaleLowerCase().includes((rule.value ?? "").toLocaleLowerCase()); break;
    case "MIN_LENGTH": valid = text.length >= target; break;
    case "MAX_LENGTH": valid = text.length <= target; break;
    case "EMAIL_FORMAT": valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text); break;
    case "PHONE_FORMAT": valid = /^\+?[0-9 ()'.-]{6,20}$/.test(text); break;
    case "DATE_BEFORE": valid = Boolean(text && rule.value && text < rule.value); break;
    case "DATE_AFTER": valid = Boolean(text && rule.value && text > rule.value); break;
    case "DATE_BETWEEN": valid = Boolean(text && rule.value && rule.value2 && text >= rule.value && text <= rule.value2); break;
    case "REQUIRED_OPTION": valid = text.split("\u001f").includes(rule.value ?? ""); break;
    case "MAX_CHOICES": valid = text.split("\u001f").filter(Boolean).length <= target; break;
    case "CITY_EXACT": valid = text.localeCompare(rule.city || rule.value || "", "fr", { sensitivity: "base" }) === 0; break;
    case "CITY_RADIUS": valid = true; break;
  }
  return { valid, rule };
}
