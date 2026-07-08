// Sprint 3B — Type pur GovernancePolicy
//
// Ce fichier définit uniquement un type de gouvernance commun, tel que
// proposé (sans implémentation) dans docs/architecture/SPRINT_3A_GOVERNANCE_POLICY_AUDIT.md.
//
// Ce type n'est branché à aucun objet du Runtime (JourneyIntent, DiscoveryInvitation,
// GovernedDocument, CommunicationSession, JourneyReview). Il ne fait qu'exister,
// prêt à être référencé dans un sprint ultérieur.

export const confidentialityLevels = [
  "Private",
  "Relationship",
  "SelectedParticipants",
  "ExternalShared",
  "Produced",
  "Archived",
] as const;

export type ConfidentialityLevel = (typeof confidentialityLevels)[number];

export type InvitationModePolicy = {
  requiresAcceptance: boolean;
  qrGrantsDirectJourneyAccess: boolean;
  secureLinkGrantsDirectJourneyAccess: boolean;
  relationshipCreatedOnlyAfterAcceptance: boolean;
};

export type CommunicationModePolicy = {
  audio: boolean;
  video: boolean;
  screenSharing: boolean;
  chat: boolean;
  documents: boolean;
  aiSummary: boolean;
  verificationLevel: string;
  consentVerified: boolean;
};

export type ReviewModePolicy = {
  requiredParticipantsMustConfirm: boolean;
  summaryAcceptanceRequired: boolean;
};

// Sprint 3D — La décision "une revue de gouvernance est-elle requise ?" est
// portée ici, pas dans le composant de pilotage. Le composant se contente de
// fournir les faits observés (documents manquants) et de lire le résultat.
export type ReviewPreparationStatus = "Non planifiée" | "À prévoir";

export type ReviewPreparationDecision = {
  reviewRequired: boolean;
  status: ReviewPreparationStatus;
  message: string;
};

export function deriveReviewPreparationDecision(input: {
  reviewPolicy: ReviewModePolicy;
  hasMissingExpectedDocuments: boolean;
}): ReviewPreparationDecision {
  const reviewRequired = input.hasMissingExpectedDocuments || input.reviewPolicy.summaryAcceptanceRequired;

  return {
    reviewRequired,
    status: reviewRequired ? "À prévoir" : "Non planifiée",
    message: reviewRequired
      ? "Une revue de gouvernance est requise avant l'ouverture du parcours."
      : "Aucune revue de gouvernance n'est requise pour le moment.",
  };
}


export type DocumentModePolicy = {
  allowedParticipantIds: string[];
  deniedParticipantIds: string[];
  aiAccessAllowed: boolean;
  externalSharingAllowed: boolean;
  expiresAt?: string;
};

export type ValidationModePolicy = {
  humanValidationRequired: boolean;
  requiresAcceptance: boolean;
  summaryAcceptanceRequired: boolean;
};

export type GovernancePolicy = {
  policyId: string;
  invitationMode: InvitationModePolicy;
  confidentialityLevel: ConfidentialityLevel;
  communicationPolicy: CommunicationModePolicy;
  reviewPolicy: ReviewModePolicy;
  documentPolicy: DocumentModePolicy;
  validationPolicy: ValidationModePolicy;
};

export type CreateGovernancePolicyInput = {
  policyId: string;
  confidentialityLevel?: ConfidentialityLevel;
  invitationMode?: Partial<InvitationModePolicy>;
  communicationPolicy?: Partial<CommunicationModePolicy>;
  reviewPolicy?: Partial<ReviewModePolicy>;
  documentPolicy?: Partial<DocumentModePolicy>;
  validationPolicy?: Partial<ValidationModePolicy>;
};

export function createDefaultGovernancePolicy(input: CreateGovernancePolicyInput): GovernancePolicy {
  return {
    policyId: input.policyId,
    confidentialityLevel: input.confidentialityLevel ?? "Private",
    invitationMode: {
      requiresAcceptance: true,
      qrGrantsDirectJourneyAccess: false,
      secureLinkGrantsDirectJourneyAccess: false,
      relationshipCreatedOnlyAfterAcceptance: true,
      ...input.invitationMode,
    },
    communicationPolicy: {
      audio: false,
      video: false,
      screenSharing: false,
      chat: false,
      documents: false,
      aiSummary: false,
      verificationLevel: "None",
      consentVerified: false,
      ...input.communicationPolicy,
    },
    reviewPolicy: {
      requiredParticipantsMustConfirm: true,
      summaryAcceptanceRequired: true,
      ...input.reviewPolicy,
    },
    documentPolicy: {
      allowedParticipantIds: [],
      deniedParticipantIds: [],
      aiAccessAllowed: false,
      externalSharingAllowed: false,
      ...input.documentPolicy,
    },
    validationPolicy: {
      humanValidationRequired: true,
      requiresAcceptance: true,
      summaryAcceptanceRequired: true,
      ...input.validationPolicy,
    },
  };
}

// Sprint 5G — Mapping pur communicationPolicy -> capabilities de CommunicationSession.
// N'impose pas verificationLevel (calculé par CommunicationTrustEvaluator) et ne
// mappe pas transcription/decisions/actions/participants/protectedChannel/
// transportSessionId/mediaProvider.
export type CommunicationCapabilitiesLike = {
  audio: boolean;
  video: boolean;
  screenSharing: boolean;
  chat: boolean;
  documents: boolean;
  aiSummary: boolean;
};

export function toCommunicationCapabilities(policy: GovernancePolicy): CommunicationCapabilitiesLike {
  return {
    audio: policy.communicationPolicy.audio,
    video: policy.communicationPolicy.video,
    screenSharing: policy.communicationPolicy.screenSharing,
    chat: policy.communicationPolicy.chat,
    documents: policy.communicationPolicy.documents,
    aiSummary: policy.communicationPolicy.aiSummary,
  };
}

export type DocumentAccessPolicyLike = {

  visibilityLevel: ConfidentialityLevel;
  allowedParticipantIds: string[];
  deniedParticipantIds: string[];
  aiAccessAllowed: boolean;
  externalSharingAllowed: boolean;
  expiresAt?: string;
};

export function toDocumentAccessPolicy(policy: GovernancePolicy): DocumentAccessPolicyLike {
  return {
    visibilityLevel: policy.confidentialityLevel,
    allowedParticipantIds: [...policy.documentPolicy.allowedParticipantIds],
    deniedParticipantIds: [...policy.documentPolicy.deniedParticipantIds],
    aiAccessAllowed: policy.documentPolicy.aiAccessAllowed,
    externalSharingAllowed: policy.documentPolicy.externalSharingAllowed,
    expiresAt: policy.documentPolicy.expiresAt,
  };
}

export type GovernancePolicyValidationResult = {

  valid: boolean;
  errors: string[];
};

export function validateGovernancePolicy(policy: GovernancePolicy): GovernancePolicyValidationResult {
  const errors: string[] = [];

  if (!policy.policyId || policy.policyId.trim().length === 0) {
    errors.push("policyId is required");
  }

  if (!confidentialityLevels.includes(policy.confidentialityLevel)) {
    errors.push(`confidentialityLevel must be one of: ${confidentialityLevels.join(", ")}`);
  }

  if (!policy.invitationMode) {
    errors.push("invitationMode is required");
  } else if (
    policy.invitationMode.relationshipCreatedOnlyAfterAcceptance &&
    !policy.invitationMode.requiresAcceptance
  ) {
    errors.push(
      "invitationMode.relationshipCreatedOnlyAfterAcceptance requires invitationMode.requiresAcceptance",
    );
  }

  if (!policy.communicationPolicy) {
    errors.push("communicationPolicy is required");
  } else if (policy.communicationPolicy.aiSummary && !policy.communicationPolicy.consentVerified) {
    errors.push("communicationPolicy.aiSummary requires communicationPolicy.consentVerified");
  }

  if (!policy.documentPolicy) {
    errors.push("documentPolicy is required");
  } else {
    const overlap = policy.documentPolicy.allowedParticipantIds.filter((id) =>
      policy.documentPolicy.deniedParticipantIds.includes(id),
    );
    if (overlap.length > 0) {
      errors.push(
        `documentPolicy has participant ids both allowed and denied: ${overlap.join(", ")}`,
      );
    }
  }

  if (!policy.reviewPolicy) {
    errors.push("reviewPolicy is required");
  }

  if (!policy.validationPolicy) {
    errors.push("validationPolicy is required");
  } else if (
    policy.validationPolicy.summaryAcceptanceRequired &&
    !policy.reviewPolicy?.summaryAcceptanceRequired
  ) {
    errors.push(
      "validationPolicy.summaryAcceptanceRequired requires reviewPolicy.summaryAcceptanceRequired",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
