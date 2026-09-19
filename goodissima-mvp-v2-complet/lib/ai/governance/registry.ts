import { isProductionRuntime } from "@/lib/ai-runtime";
import { AI_CAPABILITIES } from "@/lib/ai/governance/types";
import type { AIProviderDeployment } from "@/lib/ai/governance/types";
import { mockAIProvider } from "@/lib/ai/providers/mock";
import { createMistralProvider } from "@/lib/ai/providers/mistral";

const realCapabilities = ["governancePilotage", "governanceReview", "boussoleNavigation", "explainCurrentState", "proposeJourneyStructure", "interpretHomeIntent"] as const;

export function getAIProviderDeployments(): AIProviderDeployment[] {
  const requested = (process.env.AI_PROVIDER ?? "").toLowerCase();
  const deployments: AIProviderDeployment[] = [];
  const apiKey = process.env.MISTRAL_API_KEY;
  if (apiKey) {
    deployments.push({
      providerId: "mistral",
      deploymentId: process.env.MISTRAL_DEPLOYMENT_ID || "mistral-cloud-global",
      model: process.env.MISTRAL_MODEL || "mistral-small-latest",
      deploymentType: "CLOUD",
      region: process.env.MISTRAL_REGION || "global",
      residency: "GLOBAL_CLOUD",
      retentionProfile: "PROVIDER_STANDARD",
      trainingUsageProfile: "NOT_DECLARED",
      capabilities: realCapabilities,
      maximumClassification: "CONFIDENTIAL",
      structuredOutput: true,
      streaming: false,
      languages: ["fr", "en"],
      enabled: requested === "mistral",
      priority: 10,
      adapter: createMistralProvider({ apiKey, model: process.env.MISTRAL_MODEL || "mistral-small-latest" }),
    });
  }

  const explicitlyAllowMock = (requested === "mock" || process.env.AI_ALLOW_MOCK === "true") && !isProductionRuntime();
  deployments.push({
    providerId: "mock",
    deploymentId: "mock-local-explicit",
    model: mockAIProvider.model,
    deploymentType: "LOCAL",
    region: "local",
    residency: "ON_PREMISE",
    retentionProfile: "LOCAL_ONLY",
    trainingUsageProfile: "LOCAL_ONLY",
    capabilities: AI_CAPABILITIES,
    maximumClassification: "RESTRICTED",
    structuredOutput: true,
    streaming: false,
    languages: ["fr", "en"],
    enabled: explicitlyAllowMock,
    priority: 100,
    adapter: mockAIProvider,
  });
  return deployments;
}
