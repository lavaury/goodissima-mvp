import { prisma } from "@/lib/prisma";
import { buildRelationSummaryPrompt, toPrismaJson } from "@/lib/ai/context";
import { mockAIProvider } from "@/lib/ai/providers/mock";
import { createMistralProvider } from "@/lib/ai/providers/mistral";
import type {
  AIProvider,
  AIProviderName,
  AIDraft,
  AIDraftType,
  AIRiskAnalysis,
  AIRelationContext,
  AISummary,
  AITimelineIntelligence,
} from "@/lib/ai/types";

const defaultMistralModel = "mistral-small-latest";
const relationSummaryPromptVersion = "relation-summary-v2";
const timelinePromptVersion = "timeline-intelligence-v1";
const draftPromptVersion = "draft-assistant-v1";
const riskPromptVersion = "risk-signals-v1";

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

function summarizeTimelineForAudit(timeline: AITimelineIntelligence) {
  return timeline.timelineStatus.slice(0, 500);
}

function summarizeDraftForAudit(draft: AIDraft) {
  return `${draft.draftType}: ${draft.tone}`.slice(0, 500);
}

function summarizeRiskForAudit(analysis: AIRiskAnalysis) {
  return analysis.riskSignals.map((signal) => `${signal.type}:${signal.severity}`).join(", ").slice(0, 500);
}

function buildTimelinePrompt(context: unknown) {
  return {
    system: [
      "You are Goodissima Timeline Intelligence.",
      "Use only the privacy-first JSON context provided.",
      "Return strict JSON only with: timelineStatus, inactiveSinceDays, blockers, nextBestActions, alerts.",
      "Every nextBestActions item must have label, type and reason.",
      "Allowed next action types: REQUEST_DOCUMENT, FOLLOW_UP, REQUEST_CLARIFICATION, SCHEDULE_EXCHANGE, INVESTOR_FOLLOW_UP, VALIDATION_REVIEW.",
      "Never create actions, send email, decide automatically, promise outcomes, or reveal hidden data.",
      "Detect: inactive conversation, pending action, missing document, unanswered message, complete but untreated case, clarification needed.",
      "Suggestions are advisory only and require human acceptance.",
    ].join("\n"),
    prompt: JSON.stringify(context),
  };
}

function buildDraftPrompt(context: unknown) {
  return {
    system: [
      "You are Goodissima Draft Assistant.",
      "Use system rules, template aiInstructions, privacy-first relationship context, and recent timeline only.",
      "Return strict JSON only with: draftType, subject, message, tone, warnings.",
      "Allowed draftType values: FOLLOW_UP, DOCUMENT_REQUEST, CLARIFICATION_REQUEST, INVESTOR_REPLY, PROFESSIONAL_RESPONSE.",
      "Never send messages, trigger emails, create actions, decide automatically, promise outcomes, or reveal hidden data.",
      "Avoid legal promises, discrimination, abusive pressure, private data leakage, and hallucinated documents.",
      "Add warnings when the request is unsafe, vague, aggressive, or needs human verification.",
    ].join("\n"),
    prompt: JSON.stringify(context),
  };
}

function buildRiskPrompt(context: unknown) {
  return {
    system: [
      "You are Goodissima Risk & Trust Signals.",
      "Return explanatory, contextual vigilance signals only. Never score, decide, refuse, block, or profile.",
      "Return strict JSON only with: riskSignals.",
      "Each signal must have type, severity, title, explanation, and optional recommendation.",
      "Allowed types: MISSING_DOCUMENT, INCONSISTENT_INFORMATION, UNANSWERED_REQUEST, LOW_INFORMATION, POSSIBLE_PROMPT_INJECTION, TIMELINE_INACTIVITY, UNCLEAR_INTENT, MISSING_ORGANIZATION, VARIABLE_INCOME, UNCONFIRMED_GUARANTOR.",
      "Allowed severity values: low, medium, high.",
      "Neutral wording only. No discrimination, moral judgement, automatic decision, opaque scoring, aggressive language, or hidden private data.",
      "Always explain, contextualize, recommend, and leave the decision to a human.",
    ].join("\n"),
    prompt: JSON.stringify(context),
  };
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

export async function analyzeTimelineWithAI({
  caseId,
  context,
}: {
  caseId: string;
  context: unknown;
}) {
  const provider = getConfiguredProvider();
  const prompt = buildTimelinePrompt(context);

  console.info("[ai] Timeline intelligence requested", {
    provider: provider.name,
    model: provider.model,
    action: "timeline_intelligence",
    caseId,
    promptVersion: timelinePromptVersion,
  });

  try {
    const result = await provider.analyzeTimeline({
      ...prompt,
      metadata: { caseId, promptVersion: timelinePromptVersion },
    });

    await prisma.aIEvent.create({
      data: {
        caseId,
        provider: result.provider,
        model: result.model,
        action: "timeline_intelligence",
        status: "success",
        promptVersion: timelinePromptVersion,
        outputSummary: summarizeTimelineForAudit(result.output),
      },
    });

    return {
      provider: result.provider,
      model: result.model,
      promptVersion: timelinePromptVersion,
      context: toPrismaJson(context),
      timeline: result.output,
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_TIMELINE_ERROR";

    await prisma.aIEvent.create({
      data: {
        caseId,
        provider: provider.name,
        model: provider.model,
        action: "timeline_intelligence",
        status: "error",
        promptVersion: timelinePromptVersion,
        errorCode,
      },
    });

    throw error;
  }
}

export async function generateDraftWithAI({
  caseId,
  draftType,
  instruction,
  context,
}: {
  caseId: string;
  draftType: AIDraftType;
  instruction?: string | null;
  context: unknown;
}) {
  const provider = getConfiguredProvider();
  const prompt = buildDraftPrompt({ draftType, instruction, context });

  console.info("[ai] Draft generation requested", {
    provider: provider.name,
    model: provider.model,
    action: "draft_generation",
    caseId,
    promptVersion: draftPromptVersion,
  });

  try {
    const result = await provider.generateDraft({
      ...prompt,
      metadata: { caseId, draftType, promptVersion: draftPromptVersion },
    });

    await prisma.aIEvent.create({
      data: {
        caseId,
        provider: result.provider,
        model: result.model,
        action: "draft_generation",
        status: "success",
        promptVersion: draftPromptVersion,
        outputSummary: summarizeDraftForAudit(result.output),
      },
    });

    return {
      provider: result.provider,
      model: result.model,
      promptVersion: draftPromptVersion,
      draft: result.output,
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_DRAFT_ERROR";

    await prisma.aIEvent.create({
      data: {
        caseId,
        provider: provider.name,
        model: provider.model,
        action: "draft_generation",
        status: "error",
        promptVersion: draftPromptVersion,
        errorCode,
      },
    });

    throw error;
  }
}

export async function analyzeRiskSignalsWithAI({
  caseId,
  context,
}: {
  caseId: string;
  context: unknown;
}) {
  const provider = getConfiguredProvider();
  const prompt = buildRiskPrompt(context);

  console.info("[ai] Risk analysis requested", {
    provider: provider.name,
    model: provider.model,
    action: "risk_analysis",
    caseId,
    promptVersion: riskPromptVersion,
  });

  try {
    const result = await provider.analyzeRiskSignals({
      ...prompt,
      metadata: { caseId, promptVersion: riskPromptVersion },
    });

    await prisma.aIEvent.create({
      data: {
        caseId,
        provider: result.provider,
        model: result.model,
        action: "risk_analysis",
        status: "success",
        promptVersion: riskPromptVersion,
        outputSummary: summarizeRiskForAudit(result.output),
      },
    });

    return {
      provider: result.provider,
      model: result.model,
      promptVersion: riskPromptVersion,
      riskAnalysis: result.output,
    };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_RISK_ERROR";

    await prisma.aIEvent.create({
      data: {
        caseId,
        provider: provider.name,
        model: provider.model,
        action: "risk_analysis",
        status: "error",
        promptVersion: riskPromptVersion,
        errorCode,
      },
    });

    throw error;
  }
}
