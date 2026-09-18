import { AI_CAPABILITY_REGISTRY } from "./capabilities.ts";
import type { AIDataClassification, AIPolicyDecision, AIPolicyRequest, AIProviderDeployment } from "./types.ts";

export const AI_POLICY_VERSION = "ai-governance-v1";
const levels: Record<AIDataClassification, number> = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, SENSITIVE: 3, RESTRICTED: 4 };

export function highestAIClassification(values: readonly AIDataClassification[]) {
  return values.reduce((highest, value) => levels[value] > levels[highest] ? value : highest, "PUBLIC");
}

export function decideAIPolicy(request: AIPolicyRequest, deployments: readonly AIProviderDeployment[]): AIPolicyDecision {
  const capability = AI_CAPABILITY_REGISTRY[request.capability];
  if (!capability) return { status: "DENIED", policyVersion: AI_POLICY_VERSION, reason: "AI_CAPABILITY_UNAVAILABLE" };
  if (levels[request.classification] > levels[capability.maximumClassification]) return { status: "DENIED", policyVersion: AI_POLICY_VERSION, reason: "AI_POLICY_DENIED" };

  const authorized = deployments.filter((deployment) => {
    if (!deployment.enabled || !deployment.capabilities.includes(request.capability)) return false;
    if (levels[request.classification] > levels[deployment.maximumClassification]) return false;
    if (request.residencyRequirement && deployment.residency !== request.residencyRequirement) return false;
    if (request.allowedDeploymentTypes && !request.allowedDeploymentTypes.includes(deployment.deploymentType)) return false;
    if (request.allowedRetentionProfiles && !request.allowedRetentionProfiles.includes(deployment.retentionProfile)) return false;
    if (request.allowedDeploymentIds && !request.allowedDeploymentIds.includes(deployment.deploymentId)) return false;
    if (deployment.providerId === "mock" && !request.allowMock) return false;
    return !capability.structuredOutput || deployment.structuredOutput;
  }).sort((left, right) => left.priority - right.priority);

  return authorized.length
    ? { status: "AUTHORIZED", policyVersion: AI_POLICY_VERSION, deployments: authorized }
    : { status: "DENIED", policyVersion: AI_POLICY_VERSION, reason: "AI_POLICY_DENIED" };
}
