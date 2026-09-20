import type { AIProvider, AIProviderUsage } from "@/lib/ai/types";

export const AI_CAPABILITIES = [
  "governancePilotage",
  "governanceReview",
  "boussoleNavigation",
  "explainCurrentState",
  "proposeJourneyStructure",
  "interpretHomeIntent",
  "summarizeAuthorizedMemory",
  "compareObjects",
  "detectPotentialContradiction",
  "detectPotentialObsolescence",
  "extractCandidateFacts",
  "proposeRelations",
  "semanticSearch",
  "translate",
] as const;

export type AICapabilityId = (typeof AI_CAPABILITIES)[number];
export type AIDataClassification = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SENSITIVE" | "RESTRICTED";
export type AIDeploymentType = "CLOUD" | "PRIVATE_CLOUD" | "ON_PREMISE" | "LOCAL";
export type AIResidency = "GLOBAL_CLOUD" | "EU_ONLY" | "FR_ONLY" | "PRIVATE" | "ON_PREMISE";
export type AIRetentionProfile = "PROVIDER_STANDARD" | "NO_CONTENT_RETENTION" | "LOCAL_ONLY";
export type AITrainingUsageProfile = "NOT_DECLARED" | "NO_TRAINING" | "LOCAL_ONLY";

export type AICapabilityDefinition = {
  id: AICapabilityId;
  structuredOutput: boolean;
  streaming: boolean;
  languages: readonly string[];
  maximumClassification: AIDataClassification;
  timeoutMs: number;
  maxInputCharacters: number;
  permittedPersonalData: readonly ("EMAIL" | "NAME" | "BUSINESS_IDENTIFIER" | "ORGANIZATION")[];
};

export type AIProviderDeployment = {
  providerId: string;
  deploymentId: string;
  model: string;
  deploymentType: AIDeploymentType;
  region: string;
  residency: AIResidency;
  retentionProfile: AIRetentionProfile;
  trainingUsageProfile: AITrainingUsageProfile;
  capabilities: readonly AICapabilityId[];
  maximumClassification: AIDataClassification;
  structuredOutput: boolean;
  streaming: boolean;
  languages: readonly string[];
  enabled: boolean;
  priority: number;
  adapter: AIProvider;
};

export type AuthorizedAIContext = {
  type: string;
  id?: string | null;
  data: unknown;
  authorizedObjectIds?: readonly string[];
};

export type AIPolicyRequest = {
  capability: AICapabilityId;
  classification: AIDataClassification;
  actorId?: string | null;
  ownerId?: string | null;
  organizationId?: string | null;
  contextType: string;
  contextId?: string | null;
  purpose: string;
  residencyRequirement?: AIResidency;
  allowedDeploymentTypes?: readonly AIDeploymentType[];
  allowedRetentionProfiles?: readonly AIRetentionProfile[];
  allowedDeploymentIds?: readonly string[];
  allowMock?: boolean;
};

export type AIPolicyDecision =
  | { status: "AUTHORIZED"; policyVersion: string; deployments: AIProviderDeployment[] }
  | { status: "DENIED"; policyVersion: string; reason: AIGovernanceErrorCode };

export type AIExecutionProvenance = {
  capability: AICapabilityId;
  providerId: string;
  deploymentId: string;
  model: string;
  generatedAt: string;
  actorId: string | null;
  contextType: string;
  contextId: string | null;
  classification: AIDataClassification;
  policyVersion: string;
  promptVersion: string;
  inputFingerprint: string;
  outputFingerprint: string;
  latencyMs: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  status: "SUCCESS" | "ERROR";
  errorCategory: AIGovernanceErrorCode | null;
};

export type AIGovernedRequest<T> = {
  capability: AICapabilityId;
  context: AuthorizedAIContext;
  classification: AIDataClassification;
  actorId?: string | null;
  ownerId?: string | null;
  organizationId?: string | null;
  purpose: string;
  promptVersion: string;
  system: string;
  prompt: unknown;
  responseFormat?: { type: "json_object" } | { type: "json_schema"; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
  policy?: Omit<AIPolicyRequest, "capability" | "classification" | "actorId" | "ownerId" | "organizationId" | "contextType" | "contextId" | "purpose">;
  validateOutput: (output: string, authorizedObjectIds: ReadonlySet<string>) => T;
};

export type AIGovernedResult<T> = { output: T; provenance: AIExecutionProvenance } & AIProviderUsage;

export type AIGovernanceErrorCode =
  | "AI_CAPABILITY_UNAVAILABLE"
  | "AI_POLICY_DENIED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_OUTPUT_INVALID"
  | "AI_CONTEXT_NOT_AUTHORIZED"
  | "AI_CONTEXT_TOO_LARGE"
  | "AI_CONTEXT_INVALID"
  | "AI_SOURCE_ACCESS_DENIED"
  | "AI_CONTEXT_CLASSIFICATION_UNSUPPORTED";

export class AIGovernanceError extends Error {
  readonly code: AIGovernanceErrorCode;

  constructor(code: AIGovernanceErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.code = code;
    this.name = "AIGovernanceError";
  }
}
