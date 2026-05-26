import { prisma } from "@/lib/prisma";
import { buildRelationSummaryPrompt, toPrismaJson } from "@/lib/ai/context";
import { mockAIProvider } from "@/lib/ai/providers/mock";
import { createMistralProvider } from "@/lib/ai/providers/mistral";
import type { AIProvider, AIProviderName, AIRelationContext, AISummary } from "@/lib/ai/types";

const defaultMistralModel = "mistral-small-latest";
const relationSummaryPromptVersion = "relation-summary-v2";

function getConfiguredProvider(): AIProvider {
  const configured = (process.env.AI_PROVIDER ?? "mock").toLowerCase() as AIProviderName;
  const mistralApiKey = process.env.MISTRAL_API_KEY;
  const mistralModel = process.env.MISTRAL_MODEL || defaultMistralModel;

  if (configured === "mistral" && mistralApiKey) {
    return createMistralProvider({ apiKey: mistralApiKey, model: mistralModel });
  }

  if (configured === "mistral" && !mistralApiKey) {
    console.info("[ai] Falling back to mock provider", {
      provider: "mock",
      requestedProvider: "mistral",
      model: mockAIProvider.model,
      reason: "missing_api_key",
    });
  }

  return mockAIProvider;
}

function summarizeOutputForAudit(summary: AISummary) {
  return summary.summary.slice(0, 500);
}

export async function summarizeRelationWithAI({
  caseId,
  context,
}: {
  caseId: string;
  context: AIRelationContext;
}) {
  const provider = getConfiguredProvider();
  const prompt = buildRelationSummaryPrompt(context);

  console.info("[ai] Relation summary requested", {
    provider: provider.name,
    model: provider.model,
    action: "summary",
    caseId,
    promptVersion: relationSummaryPromptVersion,
  });

  try {
    const result = await provider.summarize({
      ...prompt,
      metadata: { caseId, promptVersion: relationSummaryPromptVersion },
    });

    await prisma.aIEvent.create({
      data: {
        caseId,
        provider: result.provider,
        model: result.model,
        action: "summary",
        status: "success",
        promptVersion: relationSummaryPromptVersion,
        outputSummary: summarizeOutputForAudit(result.output),
      },
    });

    console.info("[ai] Relation summary completed", {
      provider: result.provider,
      model: result.model,
      action: "summary",
      caseId,
      status: "success",
    });

    return {
      provider: result.provider,
      model: result.model,
      promptVersion: relationSummaryPromptVersion,
      context: toPrismaJson(context),
      summary: result.output,
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_ERROR";

    await prisma.aIEvent.create({
      data: {
        caseId,
        provider: provider.name,
        model: provider.model,
        action: "summary",
        status: "error",
        promptVersion: relationSummaryPromptVersion,
        errorCode,
      },
    });

    console.info("[ai] Relation summary failed", {
      provider: provider.name,
      model: provider.model,
      action: "summary",
      caseId,
      status: "error",
      errorCode,
    });

    throw error;
  }
}
