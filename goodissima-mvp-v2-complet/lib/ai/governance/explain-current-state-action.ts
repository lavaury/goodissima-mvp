"use server";
import { buildGovernedJourneyAuthorizedAIContext } from "@/lib/ai/governance/context-runtime";
import { assertAuthorizedAIContextEgress } from "@/lib/ai/governance/context";
import { routeAI } from "@/lib/ai/governance/router";
import { AIGovernanceError } from "@/lib/ai/governance/types";
import { allowedCurrentStateStatements, CURRENT_STATE_EXPLAIN_PROMPT_VERSION, CURRENT_STATE_EXPLAIN_SYSTEM, currentStateFromContext, currentStateIsEmpty, EMPTY_CURRENT_STATE_EXPLANATION, validateCurrentStateExplanation } from "@/lib/ai/governance/explain-current-state";

export type CurrentStateExplainResult = { explanation?: string; generatedAt?: string; generatedByAI?: boolean; error?: string };

function humanError(error: unknown) {
  if (error instanceof AIGovernanceError) {
    if (error.code === "AI_CONTEXT_NOT_AUTHORIZED") return "Cette explication n’est pas accessible pour ce Parcours.";
    if (error.code === "AI_POLICY_DENIED" || error.code === "AI_CONTEXT_CLASSIFICATION_UNSUPPORTED") return "L’explication IA n’est pas disponible avec les règles de protection applicables à ce Parcours.";
    if (error.code === "AI_OUTPUT_INVALID") return "L’explication IA n’a pas pu être validée.";
  }
  return "L’explication IA est momentanément indisponible.";
}

export async function explainGovernedJourneyCurrentStateAction(journeyId: string): Promise<CurrentStateExplainResult> {
  try {
    if (!journeyId || journeyId.length > 128) throw new AIGovernanceError("AI_CONTEXT_NOT_AUTHORIZED");
    // A new one-execution snapshot is built on every explicit click; the client supplies only the Journey id.
    const prepared = await buildGovernedJourneyAuthorizedAIContext({ journeyId, capability: "explainCurrentState" });
    assertAuthorizedAIContextEgress(prepared);
    const state = currentStateFromContext(prepared);
    if (currentStateIsEmpty(state)) return { explanation: EMPTY_CURRENT_STATE_EXPLANATION, generatedByAI: false };
    const allowed = allowedCurrentStateStatements(state);
    const result = await routeAI({
      capability: "explainCurrentState", context: prepared.context, classification: prepared.classification,
      purpose: "explain_governed_current_state", promptVersion: CURRENT_STATE_EXPLAIN_PROMPT_VERSION,
      system: CURRENT_STATE_EXPLAIN_SYSTEM, prompt: { allowedStatements: allowed }, responseFormat: { type: "json_object" },
      validateOutput: (output) => validateCurrentStateExplanation(output, allowed),
      policy: { allowMock: false },
    });
    return { explanation: result.output, generatedAt: result.provenance.generatedAt, generatedByAI: true };
  } catch (error) { return { error: humanError(error) }; }
}
