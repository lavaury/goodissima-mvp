export type DossierSituationStatus = "Actif" | "Incomplet" | "Bloqué" | "À surveiller" | "Clôturé";

import { candidateIdentityRecommendation, type CandidateIdentityState } from "./candidate-identity.ts";
import { humanizeRelationEvent } from "./events/humanize.ts";

export type DossierOperationalStatusLevel = "UP_TO_DATE" | "RECOMMENDED_ACTION" | "NEEDS_ATTENTION" | "BLOCKED" | "NEW";

export type DossierSituationAction = "FOLLOW_UP" | "DOCUMENT_REQUEST" | "SUMMARY" | "SIGNALS" | "TIMELINE" | "IDENTITY_REQUEST";

export type DossierSituationInput = {
  status: string;
  governanceStatus: string;
  priority?: string;
  matchingEnabled: boolean;
  candidateIdentity?: CandidateIdentityState;
  createdAt: Date | string;
  documents: Array<{ id: string; fileName: string; createdAt?: Date | string | null }>;
  relationActions: Array<{
    id: string;
    type: string;
    status: string;
    title: string;
    description?: string | null;
    createdAt: Date | string;
    completedAt?: Date | string | null;
  }>;
  relationEvents: Array<{
    id: string;
    type: string;
    actorType?: string | null;
    createdAt: Date | string;
  }>;
};

export type DossierSituation = {
  status: DossierSituationStatus;
  statusDetail: string;
  operationalStatus: {
    level: DossierOperationalStatusLevel;
    label: "À jour" | "Action recommandée" | "Attention requise" | "Dossier bloqué" | "Nouveau dossier";
    description: string;
    reasons: string[];
  };
  lastActivityLabel: string;
  lastActivityEvidence: string;
  missingDocumentsCount: number;
  openRelationalRequestsCount: number;
  detectedBlockersCount: number;
  pendingRelationshipActionsCount: number;
  identityStatus: CandidateIdentityState["status"];
  identityDisplayName: string;
  identityDisplayEmail: string;
  identityMissing: boolean;
  recommendedAction: string;
  recommendedActionType: DossierSituationAction;
  recommendedDraftInstruction: string;
  evidence: {
    lastEvent?: string;
    missingDocument?: string;
    signalDetected?: string;
    openRequest?: string;
    identity?: string;
    matchingState: string;
  };
};

const closedStatuses = new Set(["CLOSED", "ARCHIVED"]);
const closedGovernanceStatuses = new Set(["CLOSED"]);
const blockedGovernanceStatuses = new Set(["BLOCKED", "SUSPENDED"]);
const pendingStatuses = new Set(["PENDING", "OPEN", "TODO", "IN_PROGRESS"]);

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function formatRelativeActivity(date: Date | null) {
  if (!date) return "À préciser";
  const days = daysSince(date);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "il y a 1 jour";
  return `il y a ${days} jours`;
}

function getLatestActivity(input: DossierSituationInput) {
  const candidates = [
    { date: toDate(input.createdAt), label: "Dossier créé" },
    ...input.documents.map((document) => ({
      date: toDate(document.createdAt),
      label: `Document ajouté : ${document.fileName}`,
    })),
    ...input.relationActions.map((action) => ({
      date: toDate(action.completedAt ?? action.createdAt),
      label: `${action.status === "COMPLETED" ? "Demande traitée" : "Demande ouverte"} : ${action.title}`,
    })),
    ...input.relationEvents.map((event) => ({
      date: toDate(event.createdAt),
      label: humanizeRelationEvent(event.type).title,
    })),
  ].filter((candidate): candidate is { date: Date; label: string } => Boolean(candidate.date));

  return candidates.sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null;
}

function isPendingAction(action: DossierSituationInput["relationActions"][number]) {
  return pendingStatuses.has(action.status) || action.status !== "COMPLETED";
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

export function buildDossierSituation(input: DossierSituationInput): DossierSituation {
  const latestActivity = getLatestActivity(input);
  const candidateIdentity = input.candidateIdentity;
  const pendingActions = input.relationActions.filter(isPendingAction);
  const missingDocumentActions = pendingActions.filter((action) => action.type === "DOCUMENT_REQUEST");
  const pendingNonDocumentActions = pendingActions.filter((action) => action.type !== "DOCUMENT_REQUEST");
  const staleOpenRequest = latestActivity ? daysSince(latestActivity.date) >= 4 && pendingActions.length > 0 : false;
  const oldestPendingAction = pendingActions
    .map((action) => toDate(action.createdAt))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const oldestPendingActionAgeDays = oldestPendingAction ? daysSince(oldestPendingAction) : 0;
  const hasActivityBeyondCreation = input.documents.length > 0 || input.relationActions.length > 0 || input.relationEvents.length > 0;
  const createdAt = toDate(input.createdAt);
  const governanceBlocked = blockedGovernanceStatuses.has(input.governanceStatus);
  const closed = closedStatuses.has(input.status) || closedGovernanceStatuses.has(input.governanceStatus);
  const blockers = [
    governanceBlocked ? "Gouvernance bloquée ou suspendue" : "",
    missingDocumentActions.length ? "Document requis en attente" : "",
    pendingNonDocumentActions.length ? "Demande relationnelle en attente" : "",
    staleOpenRequest ? "Demande ouverte sans activité récente" : "",
  ].filter(Boolean);

  let status: DossierSituationStatus = "Actif";
  if (closed) status = "Clôturé";
  else if (governanceBlocked) status = "Bloqué";
  else if (missingDocumentActions.length > 0) status = "Incomplet";
  else if (blockers.length > 0 || input.priority === "URGENT" || input.priority === "HIGH") status = "À surveiller";

  const operationalReasons: string[] = [];
  let operationalStatus: DossierSituation["operationalStatus"];

  if (governanceBlocked || input.status === "BLOCKED") {
    operationalReasons.push(governanceBlocked ? "Exigence de gouvernance bloquée ou suspendue" : "Dossier marqué comme bloqué");
    if (missingDocumentActions.length > 0) operationalReasons.push(`${missingDocumentActions[0].title} en attente`);
    operationalStatus = {
      level: "BLOCKED",
      label: "Dossier bloqué",
      description: "La progression est actuellement bloquée par une condition objective du dossier.",
      reasons: operationalReasons,
    };
  } else if (!hasActivityBeyondCreation && input.status === "NEW") {
    operationalReasons.push(createdAt ? `Dossier créé ${formatRelativeActivity(createdAt)}` : "Dossier créé récemment");
    operationalReasons.push("Aucune activité exploitable enregistrée");
    operationalStatus = {
      level: "NEW",
      label: "Nouveau dossier",
      description: "Le dossier vient d'être créé et ne contient pas encore assez d'activité pour évaluer sa progression.",
      reasons: operationalReasons,
    };
  } else if (missingDocumentActions.length >= 2 || staleOpenRequest || input.priority === "URGENT" || input.priority === "HIGH") {
    if (missingDocumentActions.length >= 2) {
      operationalReasons.push(pluralize(missingDocumentActions.length, "document manquant", "documents manquants"));
    }
    if (staleOpenRequest) {
      operationalReasons.push(`${pluralize(pendingActions.length, "demande ouverte", "demandes ouvertes")} depuis ${oldestPendingActionAgeDays || 4} jours`);
    }
    if (input.priority === "URGENT" || input.priority === "HIGH") {
      operationalReasons.push("Priorité élevée sur le dossier");
    }
    operationalStatus = {
      level: "NEEDS_ATTENTION",
      label: "Attention requise",
      description: "La qualité ou la progression du dossier est à risque.",
      reasons: operationalReasons,
    };
  } else if (missingDocumentActions.length > 0 || pendingActions.length > 0 || candidateIdentity?.isMissingIdentity || input.matchingEnabled) {
    if (missingDocumentActions.length > 0) operationalReasons.push(`${missingDocumentActions[0].title} à demander`);
    if (pendingNonDocumentActions.length > 0) operationalReasons.push(`${pendingNonDocumentActions[0].title} en attente`);
    if (candidateIdentity?.isMissingIdentity) operationalReasons.push(candidateIdentity.recommendation ?? candidateIdentityRecommendation);
    if (input.matchingEnabled && operationalReasons.length === 0) operationalReasons.push("Vérifier la prochaine action dans la timeline");
    operationalStatus = {
      level: "RECOMMENDED_ACTION",
      label: "Action recommandée",
      description: "Le dossier peut continuer, avec une prochaine action utile à effectuer.",
      reasons: operationalReasons,
    };
  } else {
    operationalStatus = {
      level: "UP_TO_DATE",
      label: "À jour",
      description: "Aucun blocage, information critique manquante ou action urgente détectée.",
      reasons: ["Aucun blocage détecté", "Aucune demande ouverte", "Aucun document manquant"],
    };
  }

  let recommendedActionType: DossierSituationAction = "SUMMARY";
  let recommendedAction = "Préparer un résumé du dossier.";
  let recommendedDraftInstruction = "Préparer une synthèse courte du dossier, factuelle et sans décision automatique.";

  if (candidateIdentity?.isMissingIdentity && !closed && !governanceBlocked) {
    recommendedActionType = "IDENTITY_REQUEST";
    recommendedAction = candidateIdentityRecommendation;
    recommendedDraftInstruction = "Préparer une demande courte pour recueillir le nom complet et l'adresse email du candidat, sans inventer d'information.";
  } else if (closed) {
    recommendedActionType = "SUMMARY";
    recommendedAction = "Consulter le résumé avant archivage ou suivi.";
  } else if (governanceBlocked) {
    recommendedActionType = "SIGNALS";
    recommendedAction = "Voir les signaux avant toute action.";
  } else if (missingDocumentActions.length > 0) {
    recommendedActionType = "DOCUMENT_REQUEST";
    recommendedAction = "Préparer une relance documentaire.";
    recommendedDraftInstruction = `Préparer une relance polie pour demander le document ou l'information suivante : ${missingDocumentActions[0].title}.`;
  } else if (pendingNonDocumentActions.length > 0 || staleOpenRequest) {
    recommendedActionType = "FOLLOW_UP";
    recommendedAction = "Préparer une relance sur la demande ouverte.";
    recommendedDraftInstruction = `Préparer une relance claire concernant la demande ouverte : ${pendingActions[0]?.title ?? "demande en attente"}.`;
  } else if (input.matchingEnabled) {
    recommendedActionType = "TIMELINE";
    recommendedAction = "Vérifier la timeline puis les correspondances si nécessaire.";
  }

  return {
    status,
    statusDetail: `Dossier ${status.toLowerCase()}`,
    operationalStatus,
    lastActivityLabel: formatRelativeActivity(latestActivity?.date ?? null),
    lastActivityEvidence: latestActivity?.label ?? "Aucune activité disponible",
    missingDocumentsCount: missingDocumentActions.length,
    openRelationalRequestsCount: pendingActions.length,
    detectedBlockersCount: blockers.length,
    pendingRelationshipActionsCount: pendingNonDocumentActions.length,
    identityStatus: candidateIdentity?.status ?? "Vérification requise",
    identityDisplayName: candidateIdentity?.displayName ?? "Candidat non identifié",
    identityDisplayEmail: candidateIdentity?.displayEmail ?? "Contact non renseigné",
    identityMissing: candidateIdentity?.isMissingIdentity ?? true,
    recommendedAction,
    recommendedActionType,
    recommendedDraftInstruction,
    evidence: {
      lastEvent: latestActivity?.label,
      missingDocument: missingDocumentActions[0]?.title,
      signalDetected: blockers[0],
      openRequest: pendingActions[0]?.title,
      identity: candidateIdentity?.recommendation,
      matchingState: input.matchingEnabled ? "Matching activé pour ce dossier" : "Matching non activé pour ce dossier",
    },
  };
}
