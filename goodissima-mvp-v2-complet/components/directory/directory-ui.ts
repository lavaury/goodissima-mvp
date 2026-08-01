import type { RepresentationRelationshipPolicy, RepresentationStatus, RepresentationType, RepresentationVisibility } from "@/lib/directory/contracts";

export type DirectoryRepresentation = {
  id: string;
  type: RepresentationType;
  displayName: string;
  title: string | null;
  organizationName: string | null;
  description: string | null;
  territory: string | null;
  status: RepresentationStatus;
  relationshipPolicy: RepresentationRelationshipPolicy;
  visibility: RepresentationVisibility;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export const representationTypeLabels: Record<RepresentationType, string> = {
  PROFESSIONAL: "Professionnel",
  ORGANIZATION_REPRESENTATIVE: "Représentant d’une organisation",
  ASSOCIATION: "Association",
  PRIVATE: "Privé",
  OTHER: "Autre",
};

export const representationStatusLabels: Record<RepresentationStatus, string> = {
  ACTIVE: "Active",
  HIDDEN: "Masquée",
  ARCHIVED: "Archivée",
};

const statusOrder: Record<RepresentationStatus, number> = { ACTIVE: 0, HIDDEN: 1, ARCHIVED: 2 };

export function sortRepresentations(items: DirectoryRepresentation[]) {
  return [...items].sort((left, right) =>
    statusOrder[left.status] - statusOrder[right.status]
    || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    || left.id.localeCompare(right.id));
}
