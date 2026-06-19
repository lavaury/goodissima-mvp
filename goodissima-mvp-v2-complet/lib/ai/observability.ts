import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AIProviderUsage } from "@/lib/ai/types";

export type AIObservabilityFeature =
  | "relation_summary"
  | "timeline_intelligence"
  | "draft_assistant"
  | "risk_signals"
  | "template_designer"
  | "semantic_embedding"
  | "template_critic"
  | "template_optimizer";

export function toAIEventUsageData(usage: AIProviderUsage | null | undefined) {
  return {
    tokensInput: usage?.tokensInput ?? null,
    tokensOutput: usage?.tokensOutput ?? null,
    promptTokens: usage?.tokensInput ?? null,
    completionTokens: usage?.tokensOutput ?? null,
    estimatedCostEur: usage?.estimatedCostEur ?? null,
    latencyMs: usage?.latencyMs ?? null,
  };
}

export function getAIUsageFromError(error: unknown): AIProviderUsage | null {
  if (!error || typeof error !== "object" || !("aiUsage" in error)) return null;
  const usage = (error as { aiUsage?: unknown }).aiUsage;
  return usage && typeof usage === "object" ? (usage as AIProviderUsage) : null;
}

export async function resolveAIObservabilityContext(input: {
  caseId?: string | null;
  userId?: string | null;
  templateId?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
}) {
  if (input.caseId) {
    const relationCase = await prisma.relationCase.findUnique({
      where: { id: input.caseId },
      select: {
        ownerId: true,
        templateId: true,
        owner: { select: { name: true, email: true } },
      },
    });
    if (relationCase) {
      return {
        userId: input.userId ?? relationCase.ownerId,
        templateId: input.templateId ?? relationCase.templateId,
        organizationId: input.organizationId ?? relationCase.ownerId,
        organizationName: input.organizationName ?? relationCase.owner.name ?? relationCase.owner.email,
      };
    }
  }

  if (input.userId && (!input.organizationId || !input.organizationName)) {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true, email: true } });
    return {
      userId: input.userId,
      templateId: input.templateId ?? null,
      organizationId: input.organizationId ?? input.userId,
      organizationName: input.organizationName ?? user?.name ?? user?.email ?? null,
    };
  }

  return {
    userId: input.userId ?? null,
    templateId: input.templateId ?? null,
    organizationId: input.organizationId ?? null,
    organizationName: input.organizationName ?? null,
  };
}

export async function recordAIEvent(input: {
  caseId?: string | null;
  userId?: string | null;
  templateId?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  featureName: AIObservabilityFeature;
  provider: string;
  model?: string | null;
  action: string;
  status: string;
  promptVersion?: string | null;
  outputSummary?: string | null;
  errorCode?: string | null;
  usage?: AIProviderUsage | null;
}) {
  const context = await resolveAIObservabilityContext(input);
  return prisma.aIEvent.create({
    data: {
      caseId: input.caseId ?? null,
      ...context,
      featureName: input.featureName,
      provider: input.provider,
      model: input.model ?? null,
      action: input.action,
      status: input.status,
      promptVersion: input.promptVersion ?? null,
      outputSummary: input.outputSummary ?? null,
      errorCode: input.errorCode ?? null,
      ...toAIEventUsageData(input.usage),
    } satisfies Prisma.AIEventUncheckedCreateInput,
  });
}
