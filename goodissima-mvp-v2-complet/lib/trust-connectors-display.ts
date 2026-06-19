import type { TrustConnectorProviderType, TrustedOrganizationStatus } from "@prisma/client";

export const demoTrustConnectorCode = "GOODISSIMA_DEMO_AUTHORITY";

const connectorNameLabels: Record<string, string> = {
  GOODISSIMA_DEMO_AUTHORITY: "Autorité de démonstration Goodissima",
  FRANCE_IDENTITE: "France Identité",
  EIDAS_WALLET: "Portefeuille d'identité européen",
  BANK_CONNECT: "Connecteur bancaire",
  EDUCATION_PROVIDER: "Établissement d'enseignement",
};

const connectorDescriptionLabels: Record<string, string> = {
  GOODISSIMA_DEMO_AUTHORITY: "Source de confiance de démonstration pour tester le parcours d'identité vérifiée.",
  FRANCE_IDENTITE: "Vérification d'identité publique envisagée pour les futurs parcours de confiance.",
  EIDAS_WALLET: "Partage d'attestations via le futur portefeuille d'identité européen.",
  BANK_CONNECT: "Attestations bancaires prévues pour confirmer certains signaux de confiance.",
  EDUCATION_PROVIDER: "Attestations d'établissement prévues pour les diplômes ou statuts étudiants.",
};

export const providerTypeLabels: Record<TrustConnectorProviderType, string> = {
  DEMO: "Démonstration",
  GOVERNMENT: "Administration publique",
  EUROPEAN_WALLET: "Portefeuille européen",
  BANK: "Banque",
  INSURANCE: "Assurance",
  EDUCATION: "Éducation",
  PROFESSIONAL_BODY: "Ordre professionnel",
  OTHER: "Autre source",
};

export const trustedOrganizationStatusLabels: Record<TrustedOrganizationStatus, string> = {
  PENDING: "En attente",
  TRUSTED: "Source de confiance",
  SUSPENDED: "Suspendue",
  REVOKED: "Révoquée",
};

const connectorJourneySteps: Record<string, string[]> = {
  GOODISSIMA_DEMO_AUTHORITY: [
    "Goodissima",
    "Autorité de démonstration",
    "Émission d'une attestation de test",
    "Identité vérifiée en environnement de démonstration",
  ],
  FRANCE_IDENTITE: [
    "Goodissima",
    "France Identité",
    "Vérification d'identité",
    "Retour Goodissima",
    "Identité vérifiée",
  ],
  EIDAS_WALLET: [
    "Goodissima",
    "Portefeuille d'identité européen",
    "Partage d'attestation",
    "Retour Goodissima",
    "Identité vérifiée",
  ],
  BANK_CONNECT: [
    "Goodissima",
    "Connecteur bancaire",
    "Confirmation du statut client",
    "Retour Goodissima",
    "Identité vérifiée",
  ],
  EDUCATION_PROVIDER: [
    "Goodissima",
    "Établissement d'enseignement",
    "Confirmation du diplôme ou statut étudiant",
    "Retour Goodissima",
    "Identité vérifiée",
  ],
};

export function getConnectorName(code: string, fallbackName: string) {
  return connectorNameLabels[code] ?? fallbackName;
}

export function getConnectorDescription(code: string, fallbackDescription?: string | null) {
  return connectorDescriptionLabels[code] ?? fallbackDescription ?? "Source de confiance prévue pour de futures attestations.";
}

export function getTrustedOrganizationLabel(organizationId: string) {
  return connectorNameLabels[organizationId] ?? "Source de confiance associée";
}

export function getConnectorDisplayStatus(code: string) {
  if (code === demoTrustConnectorCode) {
    return {
      label: "Disponible",
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    };
  }

  return {
    label: "Prévu",
    className: "bg-sky-50 text-sky-800 ring-sky-200",
  };
}

export function getConnectorJourneySteps(code: string) {
  return connectorJourneySteps[code] ?? [
    "Goodissima",
    "Source de confiance",
    "Attestation",
    "Retour Goodissima",
  ];
}
