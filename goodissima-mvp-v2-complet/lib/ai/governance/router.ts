import { createHash } from "node:crypto";
import { AI_CAPABILITY_REGISTRY } from "@/lib/ai/governance/capabilities";
import { minimizeForCapability, UNTRUSTED_CONTENT_POLICY } from "@/lib/ai/governance/minimize";
import { decideAIPolicy } from "@/lib/ai/governance/policy";
import { getAIProviderDeployments } from "@/lib/ai/governance/registry";
import { AIGovernanceError } from "@/lib/ai/governance/types";
import type { AIGovernedRequest, AIGovernedResult, AIGovernanceErrorCode, AIExecutionProvenance } from "@/lib/ai/governance/types";

function fingerprint(value: string) { return createHash("sha256").update(value).digest("hex"); }
function category(error: unknown): AIGovernanceErrorCode { return error instanceof AIGovernanceError ? error.code : "AI_PROVIDER_UNAVAILABLE"; }

export async function routeAI<T>(request: AIGovernedRequest<T>): Promise<AIGovernedResult<T>> {
  const definition = AI_CAPABILITY_REGISTRY[request.capability];
  if (!definition) throw new AIGovernanceError("AI_CAPABILITY_UNAVAILABLE");
  if (!request.context?.type) throw new AIGovernanceError("AI_CONTEXT_NOT_AUTHORIZED");
  const decision = decideAIPolicy({
    capability: request.capability, classification: request.classification, actorId: request.actorId,
    ownerId: request.ownerId, organizationId: request.organizationId, contextType: request.context.type,
    contextId: request.context.id, purpose: request.purpose,
    allowMock: (process.env.AI_PROVIDER ?? "").toLowerCase() === "mock" || process.env.AI_ALLOW_MOCK === "true",
    ...request.policy,
  }, getAIProviderDeployments());
  if (decision.status === "DENIED") throw new AIGovernanceError(decision.reason);

  const minimizedPrompt = minimizeForCapability(request.capability, request.context, request.prompt);
  const inputFingerprint = fingerprint(minimizedPrompt);
  let lastError: unknown;
  for (const deployment of decision.deployments) {
    const startedAt = Date.now();
    try {
      const result = await deployment.adapter.chat({
        system: `${request.system}\n\n${UNTRUSTED_CONTENT_POLICY}`,
        prompt: `<UNTRUSTED_CONTENT>\n${minimizedPrompt}\n</UNTRUSTED_CONTENT>`,
        responseFormat: request.responseFormat,
        metadata: { capability: request.capability, deploymentId: deployment.deploymentId, promptVersion: request.promptVersion },
      });
      let output: T;
      try { output = request.validateOutput(result.output, new Set(request.context.authorizedObjectIds ?? [])); }
      catch (error) { throw new AIGovernanceError("AI_OUTPUT_INVALID", { cause: error }); }
      const provenance: AIExecutionProvenance = {
        capability: request.capability, providerId: deployment.providerId, deploymentId: deployment.deploymentId,
        model: deployment.model, generatedAt: new Date().toISOString(), actorId: request.actorId ?? null,
        contextType: request.context.type, contextId: request.context.id ?? null, classification: request.classification,
        policyVersion: decision.policyVersion, promptVersion: request.promptVersion, inputFingerprint,
        outputFingerprint: fingerprint(result.output), latencyMs: result.latencyMs ?? Date.now() - startedAt,
        tokensInput: result.tokensInput ?? null, tokensOutput: result.tokensOutput ?? null, status: "SUCCESS", errorCategory: null,
      };
      return { output, provenance, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput, estimatedCostEur: result.estimatedCostEur, latencyMs: result.latencyMs };
    } catch (error) {
      lastError = error;
      if (error instanceof AIGovernanceError && error.code === "AI_OUTPUT_INVALID") throw error;
      // Every next deployment is already part of the ordered policy decision; no out-of-policy fallback is possible.
    }
  }
  throw new AIGovernanceError(category(lastError), { cause: lastError });
}

export function assertAuthorizedObjectId(value: unknown, authorizedIds: ReadonlySet<string>) {
  if (typeof value !== "string" || !authorizedIds.has(value)) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  return value;
}

export function getAIUserError(error: unknown) {
  if (error instanceof AIGovernanceError && error.code === "AI_POLICY_DENIED") return "Assistance IA indisponible pour ce contexte.";
  if (error instanceof AIGovernanceError && error.code === "AI_OUTPUT_INVALID") return "La réponse de l’assistant n’a pas pu être validée.";
  return "Assistant momentanément indisponible.";
}
