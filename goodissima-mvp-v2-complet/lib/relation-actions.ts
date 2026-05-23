export const relationActionTypes = ["DOCUMENT_REQUEST", "CONSENT", "VALIDATION", "TASK"] as const;
export const relationActionStatuses = ["PENDING", "COMPLETED"] as const;

export type RelationActionType = (typeof relationActionTypes)[number];
export type RelationActionStatus = (typeof relationActionStatuses)[number];

export function isRelationActionType(value: unknown): value is RelationActionType {
  return typeof value === "string" && relationActionTypes.includes(value as RelationActionType);
}

export function getRelationActionTypeLabel(type: string) {
  switch (type) {
    case "DOCUMENT_REQUEST":
      return "Document";
    case "CONSENT":
      return "Consentement";
    case "VALIDATION":
      return "Validation";
    case "TASK":
      return "Tache";
    default:
      return type;
  }
}

export function getRelationActionStatusLabel(status: string) {
  switch (status) {
    case "COMPLETED":
      return "Completee";
    case "PENDING":
      return "En attente";
    default:
      return status;
  }
}
