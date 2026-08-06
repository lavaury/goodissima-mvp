export type GovernedMemoryCreationActionState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  category?: "FACT" | "DECISION" | "SOURCE";
  code?: "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "CREATION_CONFLICT" | "GOVERNED_MEMORY_CREATION_FAILED";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialGovernedMemoryCreationActionState: GovernedMemoryCreationActionState = { status: "IDLE" };

export class GovernedMemoryActionInputError extends Error {}

export function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalFormText(formData: FormData, name: string) {
  return formText(formData, name) || null;
}

export function formDate(formData: FormData, name: string, required = true) {
  const value = formText(formData, name);
  if (!value && !required) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!value || Number.isNaN(date.getTime())) throw new GovernedMemoryActionInputError("INVALID_INPUT");
  return date;
}
