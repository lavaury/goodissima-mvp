import { createDefaultGovernancePolicy, type GovernancePolicy } from "./governance-policy";

export type JourneyIntentStatus = "Captured" | "Proposed" | "Corrected" | "Validated" | "JourneyCreationPlanned";

export type JourneyIntentActor = {
  name: string;
  role: string;
};

export type JourneyIntentDocument = {
  name: string;
  reason: string;
  required: boolean;
};

export type JourneyIntentDiscoveryInvitation = {
  label: string;
  targetActor: string;
  channel: "SecureLink" | "DiscoveryRequest" | "WorkspaceInvite";
  reason: string;
};

export type JourneyIntentAction = {
  title: string;
  owner: string;
  dueHint?: string;
};

export type JourneyIntent = {
  intentId: string;
  accountId: string;
  workspaceId: string;
  initialNeed: string;
  status: JourneyIntentStatus;
  createdAt: string;
  updatedAt: string;
};

export type JourneyIntentProposal = {
  proposalId: string;
  intentId: string;
  proposedBy: "AI";
  initialNeed: string;
  objective: string;
  actors: JourneyIntentActor[];
  expectedDocuments: JourneyIntentDocument[];
  confidentialityRules: string[];
  discoveryInvitations: JourneyIntentDiscoveryInvitation[];
  firstActions: JourneyIntentAction[];
  recommendedWorkspaceId: string;
  recommendedWorkspaceName: string;
  rationale: string;
  createdAt: string;
};

export type JourneyIntentDraft = {
  draftId: string;
  intentId: string;
  proposalId: string;
  correctedBy: string;
  initialNeed: string;
  objective: string;
  actors: JourneyIntentActor[];
  expectedDocuments: JourneyIntentDocument[];
  confidentialityRules: string[];
  discoveryInvitations: JourneyIntentDiscoveryInvitation[];
  firstActions: JourneyIntentAction[];
  workspaceId: string;
  workspaceName: string;
  correctionNotes: string[];
  createdAt: string;
};

export type JourneyIntentValidation = {
  validationId: string;
  intentId: string;
  proposalId: string;
  draftId: string;
  validatedBy: string;
  humanValidated: true;
  initialNeed: string;
  validatedObjective: string;
  workspaceId: string;
  validatedAt: string;
};

export type JourneyCreationPlanFromIntent = {
  journeyId: string;
  workspaceId: string;
  intentId: string;
  proposalId: string;
  draftId: string;
  validationId: string;
  title: string;
  objective: string;
  actors: JourneyIntentActor[];
  expectedDocuments: JourneyIntentDocument[];
  confidentialityRules: string[];
  discoveryInvitations: JourneyIntentDiscoveryInvitation[];
  firstActions: JourneyIntentAction[];
  initialNeed: string;
  createdBy: string;
  createdAt: string;
  source: "HumanValidatedIntent";
};

export type JourneyPilotagePreparationParticipant = JourneyIntentActor & {
  status: "Expected";
  joined: boolean;
};

export type JourneyPilotagePreparationInvitation = JourneyIntentDiscoveryInvitation & {
  status: "Sent";
};

export type JourneyPilotagePreparationAction = JourneyIntentAction & {
  status: "ToStart";
};

export type JourneyPilotagePreparationProjection = {
  roomId: string;
  journeyId: string;
  workspaceId: string;
  status: "Preparation";
  title: string;
  objective: string;
  participantCount: number;
  expectedParticipants: JourneyPilotagePreparationParticipant[];
  expectedDocuments: JourneyIntentDocument[];
  confidentialityRules: string[];
  discoveryInvitationsSent: JourneyPilotagePreparationInvitation[];
  startupActions: JourneyPilotagePreparationAction[];
  governancePolicy: GovernancePolicy;


  advancedObservations: {
    visible: false;
    hiddenUntil: "ParticipantJoined";
    hiddenSignals: ["Blockages", "Recommendations", "Health", "Momentum"];
  };
  createdAt: string;
  source: "HumanValidatedIntent";
};
// Sprint 3C — Détection existante (déplacée depuis JourneyPreparationPilotage.tsx sans
// nouvelle logique métier) d'une divergence attendue (ex : expertise / contre-expertise),
// utilisée uniquement pour alimenter GovernancePolicy.reviewPolicy au moment de la
// construction de la projection de préparation.
const divergenceKeywords = ["contradictoire", "divergence", "contre-expertise", "contre expertise"];

function hasDivergenceRule(input: { title: string; objective: string; confidentialityRules: string[] }): boolean {
  const haystack = [input.title, input.objective, ...input.confidentialityRules].join(" ").toLowerCase();
  return divergenceKeywords.some((keyword) => haystack.includes(keyword));
}
function toIsoString(value: Date | string | undefined) {
  return (typeof value === "string" ? new Date(value) : value ?? new Date()).toISOString();
}

function assertText(value: string, label: string) {
  const text = value.trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function cloneActors(actors: JourneyIntentActor[]) {
  return actors.map((actor) => ({
    name: assertText(actor.name, "actor.name"),
    role: assertText(actor.role, "actor.role"),
  }));
}

function cloneDocuments(documents: JourneyIntentDocument[]) {
  return documents.map((document) => ({
    name: assertText(document.name, "document.name"),
    reason: assertText(document.reason, "document.reason"),
    required: document.required,
  }));
}

function cloneInvitations(invitations: JourneyIntentDiscoveryInvitation[]) {
  return invitations.map((invitation) => ({
    label: assertText(invitation.label, "invitation.label"),
    targetActor: assertText(invitation.targetActor, "invitation.targetActor"),
    channel: invitation.channel,
    reason: assertText(invitation.reason, "invitation.reason"),
  }));
}

function cloneActions(actions: JourneyIntentAction[]) {
  return actions.map((action) => ({
    title: assertText(action.title, "action.title"),
    owner: assertText(action.owner, "action.owner"),
    dueHint: action.dueHint?.trim() || undefined,
  }));
}

function ensureSameIntent(intent: JourneyIntent, proposal: JourneyIntentProposal) {
  if (intent.intentId !== proposal.intentId) throw new Error("JOURNEY_INTENT_PROPOSAL_MISMATCH");
}

export function createJourneyIntent(input: {
  intentId: string;
  accountId: string;
  workspaceId: string;
  initialNeed: string;
  createdAt?: Date | string;
}): JourneyIntent {
  const at = toIsoString(input.createdAt);
  return {
    intentId: assertText(input.intentId, "intentId"),
    accountId: assertText(input.accountId, "accountId"),
    workspaceId: assertText(input.workspaceId, "workspaceId"),
    initialNeed: assertText(input.initialNeed, "initialNeed"),
    status: "Captured",
    createdAt: at,
    updatedAt: at,
  };
}

export function createJourneyIntentProposal(input: {
  intent: JourneyIntent;
  proposalId: string;
  objective: string;
  actors: JourneyIntentActor[];
  expectedDocuments: JourneyIntentDocument[];
  confidentialityRules: string[];
  discoveryInvitations: JourneyIntentDiscoveryInvitation[];
  firstActions: JourneyIntentAction[];
  recommendedWorkspaceId?: string;
  recommendedWorkspaceName: string;
  rationale: string;
  createdAt?: Date | string;
}): { intent: JourneyIntent; proposal: JourneyIntentProposal } {
  const at = toIsoString(input.createdAt);
  const proposal: JourneyIntentProposal = {
    proposalId: assertText(input.proposalId, "proposalId"),
    intentId: input.intent.intentId,
    proposedBy: "AI",
    initialNeed: input.intent.initialNeed,
    objective: assertText(input.objective, "objective"),
    actors: cloneActors(input.actors),
    expectedDocuments: cloneDocuments(input.expectedDocuments),
    confidentialityRules: input.confidentialityRules.map((rule) => assertText(rule, "confidentialityRule")),
    discoveryInvitations: cloneInvitations(input.discoveryInvitations),
    firstActions: cloneActions(input.firstActions),
    recommendedWorkspaceId: assertText(input.recommendedWorkspaceId ?? input.intent.workspaceId, "recommendedWorkspaceId"),
    recommendedWorkspaceName: assertText(input.recommendedWorkspaceName, "recommendedWorkspaceName"),
    rationale: assertText(input.rationale, "rationale"),
    createdAt: at,
  };

  return {
    intent: { ...input.intent, status: "Proposed", updatedAt: at },
    proposal,
  };
}

export function correctJourneyIntentProposal(input: {
  intent: JourneyIntent;
  proposal: JourneyIntentProposal;
  draftId: string;
  correctedBy: string;
  correctionNotes?: string[];
  objective?: string;
  actors?: JourneyIntentActor[];
  expectedDocuments?: JourneyIntentDocument[];
  confidentialityRules?: string[];
  discoveryInvitations?: JourneyIntentDiscoveryInvitation[];
  firstActions?: JourneyIntentAction[];
  workspaceId?: string;
  workspaceName?: string;
  createdAt?: Date | string;
}): { intent: JourneyIntent; draft: JourneyIntentDraft } {
  ensureSameIntent(input.intent, input.proposal);
  const at = toIsoString(input.createdAt);
  const draft: JourneyIntentDraft = {
    draftId: assertText(input.draftId, "draftId"),
    intentId: input.intent.intentId,
    proposalId: input.proposal.proposalId,
    correctedBy: assertText(input.correctedBy, "correctedBy"),
    initialNeed: input.intent.initialNeed,
    objective: assertText(input.objective ?? input.proposal.objective, "objective"),
    actors: cloneActors(input.actors ?? input.proposal.actors),
    expectedDocuments: cloneDocuments(input.expectedDocuments ?? input.proposal.expectedDocuments),
    confidentialityRules: (input.confidentialityRules ?? input.proposal.confidentialityRules).map((rule) =>
      assertText(rule, "confidentialityRule"),
    ),
    discoveryInvitations: cloneInvitations(input.discoveryInvitations ?? input.proposal.discoveryInvitations),
    firstActions: cloneActions(input.firstActions ?? input.proposal.firstActions),
    workspaceId: assertText(input.workspaceId ?? input.proposal.recommendedWorkspaceId, "workspaceId"),
    workspaceName: assertText(input.workspaceName ?? input.proposal.recommendedWorkspaceName, "workspaceName"),
    correctionNotes: (input.correctionNotes ?? []).map((note) => assertText(note, "correctionNote")),
    createdAt: at,
  };

  return {
    intent: { ...input.intent, status: "Corrected", updatedAt: at },
    draft,
  };
}

export function validateJourneyIntent(input: {
  intent: JourneyIntent;
  proposal: JourneyIntentProposal;
  draft: JourneyIntentDraft;
  validationId: string;
  validatedBy: string;
  validatedAt?: Date | string;
}): { intent: JourneyIntent; validation: JourneyIntentValidation } {
  ensureSameIntent(input.intent, input.proposal);
  if (input.draft.intentId !== input.intent.intentId) throw new Error("JOURNEY_INTENT_DRAFT_MISMATCH");
  if (input.draft.proposalId !== input.proposal.proposalId) throw new Error("JOURNEY_INTENT_DRAFT_PROPOSAL_MISMATCH");

  const at = toIsoString(input.validatedAt);
  return {
    intent: { ...input.intent, status: "Validated", updatedAt: at },
    validation: {
      validationId: assertText(input.validationId, "validationId"),
      intentId: input.intent.intentId,
      proposalId: input.proposal.proposalId,
      draftId: input.draft.draftId,
      validatedBy: assertText(input.validatedBy, "validatedBy"),
      humanValidated: true,
      initialNeed: input.intent.initialNeed,
      validatedObjective: input.draft.objective,
      workspaceId: input.draft.workspaceId,
      validatedAt: at,
    },
  };
}

export function createJourneyCreationPlanFromValidatedIntent(input: {
  intent: JourneyIntent;
  proposal: JourneyIntentProposal;
  draft: JourneyIntentDraft;
  validation: JourneyIntentValidation;
  journeyId: string;
  createdAt?: Date | string;
}): { intent: JourneyIntent; plan: JourneyCreationPlanFromIntent } {
  ensureSameIntent(input.intent, input.proposal);
  if (input.draft.intentId !== input.intent.intentId) throw new Error("JOURNEY_INTENT_DRAFT_MISMATCH");
  if (input.validation.intentId !== input.intent.intentId) throw new Error("JOURNEY_INTENT_VALIDATION_MISMATCH");
  if (input.validation.proposalId !== input.proposal.proposalId) throw new Error("JOURNEY_INTENT_VALIDATION_PROPOSAL_MISMATCH");
  if (input.validation.draftId !== input.draft.draftId) throw new Error("JOURNEY_INTENT_VALIDATION_DRAFT_MISMATCH");
  if (input.validation.humanValidated !== true) throw new Error("HUMAN_VALIDATION_REQUIRED");

  const at = toIsoString(input.createdAt);
  return {
    intent: { ...input.intent, status: "JourneyCreationPlanned", updatedAt: at },
    plan: {
      journeyId: assertText(input.journeyId, "journeyId"),
      workspaceId: input.validation.workspaceId,
      intentId: input.intent.intentId,
      proposalId: input.proposal.proposalId,
      draftId: input.draft.draftId,
      validationId: input.validation.validationId,
      title: input.draft.objective,
      objective: input.draft.objective,
      actors: cloneActors(input.draft.actors),
      expectedDocuments: cloneDocuments(input.draft.expectedDocuments),
      confidentialityRules: [...input.draft.confidentialityRules],
      discoveryInvitations: cloneInvitations(input.draft.discoveryInvitations),
      firstActions: cloneActions(input.draft.firstActions),
      initialNeed: input.intent.initialNeed,
      createdBy: input.validation.validatedBy,
      createdAt: at,
      source: "HumanValidatedIntent",
    },
  };
}

export function createJourneyPilotagePreparationFromValidatedIntent(input: {
  plan: JourneyCreationPlanFromIntent;
  roomId?: string;
  createdAt?: Date | string;
}): JourneyPilotagePreparationProjection {
  const at = toIsoString(input.createdAt ?? input.plan.createdAt);
  const journeyId = assertText(input.plan.journeyId, "journeyId");

  const expectedParticipants: JourneyPilotagePreparationParticipant[] = cloneActors(input.plan.actors).map(
    (actor) => ({
      ...actor,
      status: "Expected",
      joined: false,
    }),
  );

  return {
    roomId: assertText(input.roomId ?? `pilotage-${journeyId}`, "roomId"),
    journeyId,
    workspaceId: assertText(input.plan.workspaceId, "workspaceId"),
    status: "Preparation",
    title: input.plan.title,
    objective: input.plan.objective,
    participantCount: expectedParticipants.filter((participant) => participant.joined).length,
    expectedParticipants,
    expectedDocuments: cloneDocuments(input.plan.expectedDocuments),
    confidentialityRules: [...input.plan.confidentialityRules],
    discoveryInvitationsSent: cloneInvitations(input.plan.discoveryInvitations).map((invitation) => ({


      ...invitation,
      status: "Sent",
    })),
    startupActions: cloneActions(input.plan.firstActions).map((action) => ({
      ...action,
      status: "ToStart",
    })),
    governancePolicy: createDefaultGovernancePolicy({
      policyId: `policy-${journeyId}`,
      reviewPolicy: {
        summaryAcceptanceRequired: hasDivergenceRule({
          title: input.plan.title,
          objective: input.plan.objective,
          confidentialityRules: input.plan.confidentialityRules,
        }),
      },
    }),
    advancedObservations: {
      visible: false,
      hiddenUntil: "ParticipantJoined",
      hiddenSignals: ["Blockages", "Recommendations", "Health", "Momentum"],
    },
    createdAt: at,
    source: "HumanValidatedIntent",
  };
}
