import type { AICapabilityDefinition, AICapabilityId } from "./types.ts";

const common = { streaming: false, languages: ["fr", "en"] as const, timeoutMs: 20_000, maxInputCharacters: 24_000, permittedPersonalData: ["NAME", "BUSINESS_IDENTIFIER", "ORGANIZATION"] as const };

export const AI_CAPABILITY_REGISTRY: Readonly<Record<AICapabilityId, AICapabilityDefinition>> = {
  governancePilotage: { ...common, id: "governancePilotage", structuredOutput: true, maximumClassification: "CONFIDENTIAL" },
  governanceReview: { ...common, id: "governanceReview", structuredOutput: true, maximumClassification: "CONFIDENTIAL" },
  boussoleNavigation: { ...common, id: "boussoleNavigation", structuredOutput: false, maximumClassification: "PUBLIC", maxInputCharacters: 12_000 },
  explainCurrentState: { ...common, id: "explainCurrentState", structuredOutput: true, maximumClassification: "CONFIDENTIAL" },
  summarizeAuthorizedMemory: { ...common, id: "summarizeAuthorizedMemory", structuredOutput: true, maximumClassification: "SENSITIVE" },
  compareObjects: { ...common, id: "compareObjects", structuredOutput: true, maximumClassification: "SENSITIVE" },
  detectPotentialContradiction: { ...common, id: "detectPotentialContradiction", structuredOutput: true, maximumClassification: "SENSITIVE" },
  detectPotentialObsolescence: { ...common, id: "detectPotentialObsolescence", structuredOutput: true, maximumClassification: "SENSITIVE" },
  extractCandidateFacts: { ...common, id: "extractCandidateFacts", structuredOutput: true, maximumClassification: "SENSITIVE" },
  proposeRelations: { ...common, id: "proposeRelations", structuredOutput: true, maximumClassification: "SENSITIVE" },
  semanticSearch: { ...common, id: "semanticSearch", structuredOutput: true, maximumClassification: "SENSITIVE" },
  translate: { ...common, id: "translate", structuredOutput: true, maximumClassification: "SENSITIVE" },
};
