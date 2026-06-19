export type OpportunityLifecycle = "DRAFT" | "VALIDATED" | "PUBLISHED" | "SUSPENDED" | "CLOSED";
export type RelationshipRequestStatus = "DRAFT" | "PENDING_REVIEW" | "ACCEPTED" | "DECLINED";

export const opportunityLifecycleLabels: Record<OpportunityLifecycle, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validée",
  PUBLISHED: "Publiée",
  SUSPENDED: "Suspendue",
  CLOSED: "Clôturée",
};

export const trustLevelLabels = {
  UNVERIFIED: "Non vérifié",
  VERIFIED: "Vérifié",
  CERTIFIED: "Certifié",
} as const;

const opportunityTransitions: Record<OpportunityLifecycle, OpportunityLifecycle[]> = {
  DRAFT: ["VALIDATED"],
  VALIDATED: ["PUBLISHED"],
  PUBLISHED: ["SUSPENDED", "CLOSED"],
  SUSPENDED: ["PUBLISHED", "CLOSED"],
  CLOSED: [],
};

const requestTransitions: Record<RelationshipRequestStatus, RelationshipRequestStatus[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["ACCEPTED", "DECLINED"],
  ACCEPTED: [],
  DECLINED: [],
};

export function transitionOpportunity(current: OpportunityLifecycle, next: OpportunityLifecycle, humanConfirmed: boolean) {
  if (!humanConfirmed) throw new Error("HUMAN_CONFIRMATION_REQUIRED");
  if (!opportunityTransitions[current].includes(next)) throw new Error("INVALID_OPPORTUNITY_TRANSITION");
  return next;
}

export function transitionRelationshipRequest(current: RelationshipRequestStatus, next: RelationshipRequestStatus, humanConfirmed: boolean) {
  if (!humanConfirmed) throw new Error("HUMAN_CONFIRMATION_REQUIRED");
  if (!requestTransitions[current].includes(next)) throw new Error("INVALID_RELATIONSHIP_REQUEST_TRANSITION");
  return next;
}

export function getFriendlyMergeWording(input: { weakCriteria: string[]; explanations: string[] }) {
  return {
    strengths: input.explanations,
    attentionPoints: input.weakCriteria.length ? input.weakCriteria : ["Aucun point faible identifié"],
  };
}

export const experienceExamples = [
  "Je cherche un appartement",
  "Je cherche un locataire",
  "Je recrute un développeur",
  "Je recherche un investisseur",
  "Je recherche un partenaire",
] as const;

export const experienceGovernance = {
  automaticPublication: false,
  automaticContact: false,
  automaticDecision: false,
  hiddenWorkflowExecution: false,
  humanValidationRequired: true,
  scoringEngine: "existing-merge",
} as const;
