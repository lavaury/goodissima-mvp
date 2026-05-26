import type {
  AIClassification,
  AIDraft,
  AIDraftType,
  AISuggestedAction,
  AITimelineActionType,
  AITimelineIntelligence,
  AIProvider,
  AIProviderRequest,
  AIProviderResult,
  AISummary,
} from "@/lib/ai/types";
import { cleanAISuggestedAction } from "@/lib/ai/actions";

const mistralEndpoint = "https://api.mistral.ai/v1/chat/completions";

function parseSummary(content: string): AISummary {
  try {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<AISummary>;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.filter(isString).slice(0, 8) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.filter(isString).slice(0, 8) : [],
      suggestedActions: Array.isArray(parsed.suggestedActions)
        ? parsed.suggestedActions
            .map(cleanAISuggestedAction)
            .filter((action): action is AISuggestedAction => Boolean(action))
            .slice(0, 8)
        : [],
      missingDocuments: Array.isArray(parsed.missingDocuments)
        ? parsed.missingDocuments.filter(isString).slice(0, 8)
        : [],
    };
  } catch {
    throw new Error("MISTRAL_INVALID_JSON");
  }
}

const timelineActionTypes = [
  "REQUEST_DOCUMENT",
  "FOLLOW_UP",
  "REQUEST_CLARIFICATION",
  "SCHEDULE_EXCHANGE",
  "INVESTOR_FOLLOW_UP",
  "VALIDATION_REVIEW",
] as const satisfies readonly AITimelineActionType[];

const draftTypes = [
  "FOLLOW_UP",
  "DOCUMENT_REQUEST",
  "CLARIFICATION_REQUEST",
  "INVESTOR_REPLY",
  "PROFESSIONAL_RESPONSE",
] as const satisfies readonly AIDraftType[];

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimelineActionType(value: unknown): value is AITimelineActionType {
  return typeof value === "string" && timelineActionTypes.includes(value as AITimelineActionType);
}

function isDraftType(value: unknown): value is AIDraftType {
  return typeof value === "string" && draftTypes.includes(value as AIDraftType);
}

function parseTimelineIntelligence(content: string): AITimelineIntelligence {
  try {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<AITimelineIntelligence>;
    const inactiveSinceDays =
      typeof parsed.inactiveSinceDays === "number" && parsed.inactiveSinceDays >= 0
        ? Math.floor(parsed.inactiveSinceDays)
        : undefined;

    return {
      timelineStatus: typeof parsed.timelineStatus === "string" ? parsed.timelineStatus : "",
      inactiveSinceDays,
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers.filter(isString).slice(0, 8) : [],
      nextBestActions: Array.isArray(parsed.nextBestActions)
        ? parsed.nextBestActions
            .map((action) => {
              if (!action || typeof action !== "object") return null;
              const value = action as Record<string, unknown>;
              if (!isString(value.label) || !isString(value.reason) || !isTimelineActionType(value.type)) return null;
              return { label: value.label.slice(0, 180), type: value.type, reason: value.reason.slice(0, 600) };
            })
            .filter((action): action is AITimelineIntelligence["nextBestActions"][number] => Boolean(action))
            .slice(0, 8)
        : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts.filter(isString).slice(0, 8) : [],
    };
  } catch {
    throw new Error("MISTRAL_INVALID_TIMELINE_JSON");
  }
}

function parseDraft(content: string): AIDraft {
  try {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<AIDraft>;

    if (!isDraftType(parsed.draftType) || !isString(parsed.message) || !isString(parsed.tone)) {
      throw new Error("MISTRAL_INVALID_DRAFT_SHAPE");
    }

    return {
      draftType: parsed.draftType,
      subject: isString(parsed.subject) ? parsed.subject.slice(0, 180) : undefined,
      message: parsed.message.slice(0, 2400),
      tone: parsed.tone.slice(0, 120),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(isString).slice(0, 8) : [],
    };
  } catch {
    throw new Error("MISTRAL_INVALID_DRAFT_JSON");
  }
}

async function callMistral({
  apiKey,
  model,
  request,
  responseFormat,
}: {
  apiKey: string;
  model: string;
  request: AIProviderRequest;
  responseFormat?: { type: "json_object" };
}) {
  const res = await fetch(mistralEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: responseFormat,
      messages: [
        ...(request.system ? [{ role: "system", content: request.system }] : []),
        { role: "user", content: request.prompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`MISTRAL_${res.status}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("MISTRAL_EMPTY_RESPONSE");
  }

  return content;
}

export function createMistralProvider({
  apiKey,
  model,
}: {
  apiKey: string;
  model: string;
}): AIProvider {
  return {
    name: "mistral",
    model,
    async chat(request: AIProviderRequest): Promise<AIProviderResult<string>> {
      const output = await callMistral({ apiKey, model, request });
      return { provider: "mistral", model, output };
    },
    async summarize(request: AIProviderRequest): Promise<AIProviderResult<AISummary>> {
      const output = await callMistral({
        apiKey,
        model,
        request: {
          ...request,
          system: [
            request.system,
            "Return a strict JSON object only.",
            "The JSON schema is: {\"summary\":\"string\",\"keyPoints\":[\"string\"],\"risks\":[\"string\"],\"suggestedActions\":[{\"label\":\"string\",\"type\":\"REQUEST_DOCUMENT|FOLLOW_UP|REQUEST_CLARIFICATION|SCHEDULE_EXCHANGE|INVESTOR_FOLLOW_UP\",\"reason\":\"string\"}],\"missingDocuments\":[\"string\"]}.",
            "Do not return markdown, prose outside JSON, code fences, or hidden data.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
        responseFormat: { type: "json_object" },
      });
      return { provider: "mistral", model, output: parseSummary(output) };
    },
    async analyzeTimeline(request: AIProviderRequest): Promise<AIProviderResult<AITimelineIntelligence>> {
      const output = await callMistral({
        apiKey,
        model,
        request: {
          ...request,
          system: [
            request.system,
            "Return a strict JSON object only.",
            "The JSON schema is: {\"timelineStatus\":\"string\",\"inactiveSinceDays\":0,\"blockers\":[\"string\"],\"nextBestActions\":[{\"label\":\"string\",\"type\":\"REQUEST_DOCUMENT|FOLLOW_UP|REQUEST_CLARIFICATION|SCHEDULE_EXCHANGE|INVESTOR_FOLLOW_UP|VALIDATION_REVIEW\",\"reason\":\"string\"}],\"alerts\":[\"string\"]}.",
            "Do not create actions. Suggestions are advisory only and require human acceptance.",
            "Do not return markdown, prose outside JSON, code fences, emails, tokens, signed URLs, secrets, or hidden data.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
        responseFormat: { type: "json_object" },
      });
      return { provider: "mistral", model, output: parseTimelineIntelligence(output) };
    },
    async generateDraft(request: AIProviderRequest): Promise<AIProviderResult<AIDraft>> {
      const output = await callMistral({
        apiKey,
        model,
        request: {
          ...request,
          system: [
            request.system,
            "Return a strict JSON object only.",
            "The JSON schema is: {\"draftType\":\"FOLLOW_UP|DOCUMENT_REQUEST|CLARIFICATION_REQUEST|INVESTOR_REPLY|PROFESSIONAL_RESPONSE\",\"subject\":\"string\",\"message\":\"string\",\"tone\":\"string\",\"warnings\":[\"string\"]}.",
            "Generate a draft message only. Never send it, never trigger email, never create action.",
            "Do not make legal promises, discriminate, decide automatically, apply abusive pressure, reveal private data, or invent documents.",
            "Add warnings when the request is unsafe, vague, aggressive, or may leak private data.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
        responseFormat: { type: "json_object" },
      });
      return { provider: "mistral", model, output: parseDraft(output) };
    },
    async classify(request: AIProviderRequest): Promise<AIProviderResult<AIClassification>> {
      const output = await callMistral({
        apiKey,
        model,
        request: {
          ...request,
          system: "Return JSON only: {\"label\":\"string\",\"confidence\":0.0}.",
        },
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(output) as Partial<AIClassification>;
      return {
        provider: "mistral",
        model,
        output: {
          label: typeof parsed.label === "string" ? parsed.label : "unknown",
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
        },
      };
    },
  };
}
