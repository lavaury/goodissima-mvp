export type FormValue = string | boolean | number | null | undefined;
export type FormValues = Record<string, FormValue>;

export type ConditionalRuleAction = "SHOW" | "HIDE" | "REQUIRE" | "DISABLE";
export type ConditionalRuleOperator = "equals" | "notEquals" | "greaterThan" | "exists";

export type ConditionalRule = {
  field: string;
  operator: ConditionalRuleOperator;
  value?: FormValue;
  action: ConditionalRuleAction;
};

export type ConditionalField = {
  required: boolean;
  conditionalRules?: ConditionalRule[] | null;
};

function isEmptyValue(value: FormValue) {
  return value === null || value === undefined || value === "";
}

export function evaluateCondition(rule: ConditionalRule, values: FormValues) {
  const currentValue = values[rule.field];

  switch (rule.operator) {
    case "equals":
      return currentValue === rule.value;
    case "notEquals":
      return currentValue !== rule.value;
    case "greaterThan":
      return Number(currentValue) > Number(rule.value);
    case "exists":
      return !isEmptyValue(currentValue);
    default:
      return false;
  }
}

export function shouldDisplayField(field: ConditionalField, values: FormValues) {
  const rules = field.conditionalRules ?? [];
  const hideRules = rules.filter((rule) => rule.action === "HIDE");
  const showRules = rules.filter((rule) => rule.action === "SHOW");

  if (hideRules.some((rule) => evaluateCondition(rule, values))) {
    return false;
  }

  if (showRules.length > 0) {
    return showRules.some((rule) => evaluateCondition(rule, values));
  }

  return true;
}

export function isFieldRequired(field: ConditionalField, values: FormValues) {
  const rules = field.conditionalRules ?? [];

  return (
    field.required ||
    rules
      .filter((rule) => rule.action === "REQUIRE")
      .some((rule) => evaluateCondition(rule, values))
  );
}

export function isFieldDisabled(field: ConditionalField, values: FormValues) {
  return (field.conditionalRules ?? [])
    .filter((rule) => rule.action === "DISABLE")
    .some((rule) => evaluateCondition(rule, values));
}
