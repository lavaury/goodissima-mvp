import type {
  AIClassification,
  AISuggestedAction,
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

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
