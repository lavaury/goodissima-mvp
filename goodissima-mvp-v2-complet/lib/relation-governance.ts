import { RelationGovernanceStatus } from "@prisma/client";

export const relationGovernanceStatuses = Object.values(RelationGovernanceStatus);

export function isRelationGovernanceStatus(value: unknown): value is RelationGovernanceStatus {
  return typeof value === "string" && relationGovernanceStatuses.includes(value as RelationGovernanceStatus);
}

export function getRelationGovernanceStatusLabel(status: RelationGovernanceStatus | string) {
  switch (status) {
    case RelationGovernanceStatus.ACTIVE:
      return "Active";
    case RelationGovernanceStatus.SUSPENDED:
      return "Suspendue";
    case RelationGovernanceStatus.CLOSED:
      return "Cloturee";
    case RelationGovernanceStatus.BLOCKED:
      return "Bloquee";
    default:
      return String(status);
  }
}

export function getRelationGovernanceStatusDescription(status: RelationGovernanceStatus | string) {
  switch (status) {
    case RelationGovernanceStatus.ACTIVE:
      return "Les echanges et documents sont autorises.";
    case RelationGovernanceStatus.SUSPENDED:
      return "Les messages et documents sont temporairement bloques.";
    case RelationGovernanceStatus.CLOSED:
      return "La relation est terminee. L'historique reste consultable.";
    case RelationGovernanceStatus.BLOCKED:
      return "Le participant ne peut plus poursuivre les echanges.";
    default:
      return "Statut de gouvernance inconnu.";
  }
}

export function canWriteInRelation(status: RelationGovernanceStatus | string) {
  return status === RelationGovernanceStatus.ACTIVE;
}

export function canCandidateWriteInRelation(status: RelationGovernanceStatus | string) {
  return status === RelationGovernanceStatus.ACTIVE;
}

export function getRelationGovernanceBlockedMessage(status: RelationGovernanceStatus | string) {
  switch (status) {
    case RelationGovernanceStatus.SUSPENDED:
      return "Relation suspendue: les echanges sont temporairement bloques.";
    case RelationGovernanceStatus.CLOSED:
      return "Relation cloturee: l'historique reste consultable, les nouveaux echanges sont bloques.";
    case RelationGovernanceStatus.BLOCKED:
      return "Participant bloque: aucune nouvelle ecriture candidat n'est autorisee.";
    default:
      return "La relation n'autorise pas cette action.";
  }
}
