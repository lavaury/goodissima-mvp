import {
  isFieldDisabled,
  isFieldRequired,
  shouldDisplayField,
  type ConditionalRule,
  type FormValue,
  type FormValues,
} from "./form-rules.ts";

export type CandidateFormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue?: string | null;
  options?: unknown;
  conditionalRules?: ConditionalRule[] | null;
  validationRules?: unknown;
};

export type CandidateFormOption = { label: string; value: string };

const garageOptions: Record<string, CandidateFormOption[]> = {
  type: ["Garage fermé", "Box", "Parking couvert", "Parking extérieur", "Place sécurisée", "Indifférent / à préciser"].map((label) => ({ label, value: label })),
  size: ["Moto", "Petite voiture", "Citadine", "Berline", "SUV", "Utilitaire", "Grande taille / à préciser"].map((label) => ({ label, value: label })),
};

function normalizedWords(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function parseCandidateFieldOptions(options: unknown): CandidateFormOption[] {
  if (!Array.isArray(options)) return [];
  return options.flatMap((option) => {
    if (typeof option === "string" && option.trim()) return [{ label: option.trim(), value: option.trim() }];
    if (!option || typeof option !== "object" || Array.isArray(option)) return [];
    const row = option as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const value = typeof row.value === "string" ? row.value.trim() : "";
    return label && value ? [{ label, value }] : [];
  });
}

export function normalizePublicFormField<T extends CandidateFormField>(field: T): T {
  const type = field.type.toUpperCase();
  if (!["SELECT", "RADIO", "CHOICE"].includes(type)) return { ...field, type };
  let options = parseCandidateFieldOptions(field.options);
  const identity = normalizedWords(`${field.key} ${field.label}`);
  if (!options.length && identity.includes("garage")) {
    if (identity.includes("type")) options = garageOptions.type;
    else if (identity.includes("taille") || identity.includes("size")) options = garageOptions.size;
  }
  if (options.length) return { ...field, type: "SELECT", options };
  return { ...field, type: "TEXT", options: [], placeholder: "Précisez votre réponse." } as T;
}

export type MissingCandidateField = {
  id: string;
  label: string;
  code: "REQUIRED_FIELD_MISSING";
};

export type CandidatePublicationSafetyIssueCode =
  | "INVALID_FIELD_ID"
  | "DUPLICATE_FIELD_ID"
  | "UNSUPPORTED_REQUIRED_FIELD_TYPE"
  | "REQUIRED_FIELD_NOT_RENDERED"
  | "REQUIRED_FIELD_HIDDEN"
  | "REQUIRED_FIELD_DISABLED"
  | "MISSING_SYSTEM_MAPPING";

export type CandidatePublicationSafetyIssue = {
  code: CandidatePublicationSafetyIssueCode;
  id: string;
  label: string;
  systemField?: "candidateName" | "candidateEmail" | "message";
};

export type CandidatePublicationSafetyResult = {
  publishable: boolean;
  statusLabel: "Prêt à publier" | "Correction requise";
  issues: CandidatePublicationSafetyIssue[];
  firstIssue: CandidatePublicationSafetyIssue | null;
  error: string | null;
};

export type CandidatePublicationSafetyOptions = {
  identityRequired?: boolean;
};

const supportedFieldTypes = new Set([
  "SECTION",
  "TEXT",
  "EMAIL",
  "TEXTAREA",
  "PHONE",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTISELECT",
  "CHECKBOX",
  "FILE",
]);

const candidateNameFieldIds = ["fullName", "name", "candidateName", "contactName", "companyName", "organization", "nomComplet"];
const candidateEmailFieldIds = ["email", "contactEmail", "candidateEmail", "adresseEmail"];
const messageFieldIds = ["message", "request", "brief", "projectBrief", "description", "besoin", "demande", "descriptionBesoin"];
const validFieldIdPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
const textCompatibleFieldTypes = new Set(["TEXT", "TEXTAREA"]);

export function isCandidateIdentityFieldId(fieldId: string) {
  return candidateNameFieldIds.includes(fieldId) || candidateEmailFieldIds.includes(fieldId);
}

export function candidateIdentityRequiredFromTemplateDraft(draft: unknown) {
  return Boolean(
    draft &&
    typeof draft === "object" &&
    !Array.isArray(draft) &&
    (draft as Record<string, unknown>).identityRequired === true
  );
}

export function candidateIdentityRequiredFromSnapshotMetadata(metadata: unknown) {
  return Boolean(
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).identityRequired === true
  );
}

export function parseCandidateConditionalRules(rules: unknown): ConditionalRule[] {
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

export function toCandidateFormField(field: {
  key: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue?: string | null;
  options?: unknown;
  conditionalRules?: unknown;
  validationRules?: unknown;
}): CandidateFormField {
  return normalizePublicFormField({
    key: field.key,
    label: field.label,
    type: normalizeFieldType(field.type),
    required: field.required,
    defaultValue: field.defaultValue ?? null,
    options: field.options ?? null,
    conditionalRules: parseCandidateConditionalRules(field.conditionalRules),
    validationRules: field.validationRules,
  });
}

export function candidateFieldsFromTemplateDraft(draft: unknown): CandidateFormField[] {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return [];
  const fields = (draft as Record<string, unknown>).fields;
  if (!Array.isArray(fields)) return [];

  return fields.map((field, index) => {
    const row = field && typeof field === "object" && !Array.isArray(field) ? field as Record<string, unknown> : {};
    const key = typeof row.key === "string" ? row.key.trim() : "";
    const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : key || `Champ ${index + 1}`;

    return normalizePublicFormField({
      key,
      label,
      type: typeof row.type === "string" ? row.type.trim().toUpperCase() : "",
      required: row.required === true,
      defaultValue: typeof row.defaultValue === "string" ? row.defaultValue : null,
      options: row.options,
      conditionalRules: parseCandidateConditionalRules(row.conditionalRules),
    });
  });
}

function normalizeFieldType(type: string) {
  return type.toUpperCase();
}

function stringValue(value: FormValue) {
  return typeof value === "string" ? value.trim() : "";
}

function isSupportedCandidateField(field: CandidateFormField) {
  return supportedFieldTypes.has(normalizeFieldType(field.type));
}

function hasValidFieldId(field: CandidateFormField) {
  return validFieldIdPattern.test(field.key);
}

function compatibleSystemField(
  fields: CandidateFormField[],
  values: FormValues,
  fieldIds: string[],
  compatibleTypes: Set<string>,
) {
  return fields.find((field) => {
    const fieldType = normalizeFieldType(field.type);

    return (
      fieldIds.includes(field.key) &&
      hasValidFieldId(field) &&
      compatibleTypes.has(fieldType) &&
      shouldDisplayField(field, values) &&
      !isFieldDisabled(field, values) &&
      isFieldRequired(field, values)
    );
  });
}

export function createInitialCandidateFormValues(fields: CandidateFormField[]): FormValues {
  return fields.reduce<FormValues>((values, field) => {
    values[field.key] =
      normalizeFieldType(field.type) === "CHECKBOX"
        ? field.defaultValue === "true"
        : field.defaultValue ?? "";
    return values;
  }, {});
}

export function getRenderedCandidateFieldIds(fields: CandidateFormField[], values: FormValues = createInitialCandidateFormValues(fields)) {
  return fields
    .filter((field) => isSupportedCandidateField(field))
    .filter((field) => shouldDisplayField(field, values))
    .map((field) => field.key);
}

export function isCandidateFieldMissing(field: CandidateFormField, value: FormValue) {
  const fieldType = normalizeFieldType(field.type);
  if (fieldType === "CHECKBOX") return value !== true;
  return !stringValue(value);
}

export function findMissingRequiredCandidateField(fields: CandidateFormField[], answers: FormValues): MissingCandidateField | null {
  for (const field of fields) {
    if (!isSupportedCandidateField(field)) continue;
    if (!shouldDisplayField(field, answers)) continue;
    if (isFieldDisabled(field, answers)) continue;
    if (!isFieldRequired(field, answers)) continue;
    if (!isCandidateFieldMissing(field, answers[field.key])) continue;

    return { id: field.key, label: field.label || field.key, code: "REQUIRED_FIELD_MISSING" };
  }

  return null;
}

export function formatMissingRequiredFieldError(field: Pick<MissingCandidateField, "label">) {
  return `Le champ obligatoire « ${field.label} » est manquant.`;
}

function firstStringAnswer(answers: FormValues, fieldIds: string[]) {
  for (const fieldId of fieldIds) {
    const value = stringValue(answers[fieldId]);
    if (value) return { value, fieldId };
  }

  return { value: "", fieldId: null };
}

function hasSubmittedCompatibleField(answers: FormValues, fieldIds: string[]) {
  return fieldIds.some((fieldId) => Object.prototype.hasOwnProperty.call(answers, fieldId));
}

export function getCandidateSystemFieldSubmissionPresence(answers: FormValues) {
  return {
    candidateName: hasSubmittedCompatibleField(answers, candidateNameFieldIds),
    candidateEmail: hasSubmittedCompatibleField(answers, candidateEmailFieldIds),
    message: hasSubmittedCompatibleField(answers, messageFieldIds),
  };
}

export function buildCandidateMessageFallback(answers: FormValues) {
  const values = Object.values(answers)
    .map((value) => {
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      return "";
    })
    .filter(Boolean)
    .slice(0, 6);

  return values.length ? `Réponse au formulaire : ${values.join(" · ")}` : "Réponse au formulaire candidat.";
}

export function deriveCandidateSubmissionFields(
  answers: FormValues,
  explicit: { candidateName?: string; candidateEmail?: string; message?: string } = {},
) {
  const name = explicit.candidateName?.trim()
    ? { value: explicit.candidateName.trim(), fieldId: null }
    : firstStringAnswer(answers, candidateNameFieldIds);
  const email = explicit.candidateEmail?.trim()
    ? { value: explicit.candidateEmail.trim(), fieldId: null }
    : firstStringAnswer(answers, candidateEmailFieldIds);
  const message = explicit.message?.trim()
    ? { value: explicit.message.trim(), fieldId: null }
    : firstStringAnswer(answers, messageFieldIds);

  return {
    candidateName: name.value,
    candidateNameFieldId: name.fieldId,
    candidateEmail: email.value,
    candidateEmailFieldId: email.fieldId,
    message: message.value,
    messageFieldId: message.fieldId,
  };
}

export function inspectCandidateForm(fields: CandidateFormField[], values: FormValues = createInitialCandidateFormValues(fields)) {
  const renderedFieldIds = new Set(getRenderedCandidateFieldIds(fields, values));
  const duplicateIds = fields.reduce<Map<string, number>>((counts, field) => {
    counts.set(field.key, (counts.get(field.key) ?? 0) + 1);
    return counts;
  }, new Map());

  return fields.map((field) => {
    const supported = isSupportedCandidateField(field);
    const validId = hasValidFieldId(field);
    const duplicateId = (duplicateIds.get(field.key) ?? 0) > 1;
    const rendered = supported && validId && renderedFieldIds.has(field.key);
    const disabled = supported && rendered ? isFieldDisabled(field, values) : false;
    const required = supported && rendered && !disabled ? isFieldRequired(field, values) : field.required;
    const blocksPublication = !validId || duplicateId || (field.required && (!supported || !rendered || disabled));

    return {
      id: field.key,
      label: field.label || field.key,
      type: normalizeFieldType(field.type),
      supported,
      validId,
      duplicateId,
      required,
      baseRequired: field.required,
      rendered,
      disabled,
      defaultValue: field.defaultValue ?? null,
      blocksPublication,
    };
  });
}

export function findCandidatePublicationSafetyIssues(fields: CandidateFormField[]) {
  return inspectCandidateForm(fields).filter((field) => field.blocksPublication);
}

export function formatCandidatePublicationSafetyError(issue: Pick<CandidatePublicationSafetyIssue, "label">) {
  return `Ce parcours généré par IA n’est pas encore publiable : le champ « ${issue.label} » doit être corrigé.`;
}

export function checkCandidatePublicationSafety(
  fields: CandidateFormField[],
  options: CandidatePublicationSafetyOptions = {},
): CandidatePublicationSafetyResult {
  const values = createInitialCandidateFormValues(fields);
  const diagnostics = inspectCandidateForm(fields, values);
  const issues: CandidatePublicationSafetyIssue[] = [];

  for (const field of diagnostics) {
    if (!field.validId) {
      issues.push({ code: "INVALID_FIELD_ID", id: field.id, label: field.label });
      continue;
    }
    if (field.duplicateId) {
      issues.push({ code: "DUPLICATE_FIELD_ID", id: field.id, label: field.label });
      continue;
    }
    if (field.baseRequired && !field.supported) {
      issues.push({ code: "UNSUPPORTED_REQUIRED_FIELD_TYPE", id: field.id, label: field.label });
      continue;
    }
    if (field.baseRequired && field.disabled) {
      issues.push({ code: "REQUIRED_FIELD_DISABLED", id: field.id, label: field.label });
      continue;
    }
    if (field.baseRequired && !field.rendered) {
      issues.push({
        code: field.defaultValue === null ? "REQUIRED_FIELD_NOT_RENDERED" : "REQUIRED_FIELD_HIDDEN",
        id: field.id,
        label: field.label,
      });
    }
  }

  const nameField = compatibleSystemField(fields, values, candidateNameFieldIds, textCompatibleFieldTypes);
  const emailField = compatibleSystemField(fields, values, candidateEmailFieldIds, new Set(["EMAIL"]));
  if (options.identityRequired && !nameField) {
    issues.push({ code: "MISSING_SYSTEM_MAPPING", id: "candidateName", label: "Nom complet", systemField: "candidateName" });
  }
  if (options.identityRequired && !emailField) {
    issues.push({ code: "MISSING_SYSTEM_MAPPING", id: "candidateEmail", label: "Email", systemField: "candidateEmail" });
  }

  const firstIssue = issues[0] ?? null;

  return {
    publishable: issues.length === 0,
    statusLabel: issues.length === 0 ? "Prêt à publier" : "Correction requise",
    issues,
    firstIssue,
    error: firstIssue ? formatCandidatePublicationSafetyError(firstIssue) : null,
  };
}
