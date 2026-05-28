import type { AIProviderName } from "@/lib/ai/types";

export function isProductionRuntime() {
  return process.env.GOODISSIMA_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function getAIProvider(): AIProviderName {
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  return provider === "mistral" ? "mistral" : "mock";
}

export function isMockAIEnabled() {
  return getAIProvider() === "mock";
}

export function getRuntimeEnvironmentLabel() {
  const environment = (process.env.GOODISSIMA_ENV ?? process.env.VERCEL_ENV ?? "local").toLowerCase();

  if (environment === "production") return "PRODUCTION";
  if (environment === "staging" || environment === "preview") return "STAGING";

  return "LOCAL";
}

export function getAIProviderLabel() {
  return `AI: ${getAIProvider().toUpperCase()}`;
}
