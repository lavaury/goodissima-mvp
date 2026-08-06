"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { disputeJourneyFact, establishJourneyFact, grantJourneyMemoryRole, GovernedMemoryTransitionError, revokeJourneyMemoryRole, validateJourneyDecision } from "./persistence/journey-transition-service";
import { resolveActiveJourneyMemoryRolePublicKey } from "./cockpit-role-service";
import type { GovernedMemoryTransitionActionState } from "./cockpit-transition-action-state";
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";
const messages = {
  ESTABLISH_FACT: "Le fait est maintenant établi dans la mémoire du parcours.",
  DISPUTE_FACT: "La contestation a été ouverte.",
  VALIDATE_DECISION: "La décision a été validée.",
  GRANT_JOURNEY_MEMORY_ROLE: "Vous êtes maintenant responsable de la mémoire de ce parcours.",
  REVOKE_JOURNEY_MEMORY_ROLE: "La fonction mémoire a été révoquée. Les actions historiques restent conservées.",
} as const;

function errorState(error: unknown): GovernedMemoryTransitionActionState {
  const code = error instanceof GovernedMemoryTransitionError ? error.code : "GOVERNED_MEMORY_TRANSITION_FAILED";
  const message = code === "FORBIDDEN" ? "Vous ne disposez pas du droit requis pour cette opération."
    : code === "STATE_CONFLICT" ? "Cet élément a changé depuis son affichage. Rechargez le parcours avant de poursuivre."
    : code === "TRANSITION_CONFLICT" ? "Cette tentative ne correspond plus à l’action actuellement affichée. Vérifiez les informations puis recommencez."
    : code === "NOT_FOUND" ? "L’élément demandé n’est plus disponible."
    : code === "INVALID_INPUT" ? "Vérifiez les informations demandées."
    : code === "ALREADY_APPLIED" ? "L’état final est déjà appliqué."
    : "L’opération n’a pas pu être finalisée. Aucune modification partielle n’a été conservée.";
  return { status: "ERROR", code, message };
}

async function run(formData: FormData, transition: keyof typeof messages) {
  const user = await getCurrentPrismaUser(); const formTemplateId = value(formData, "formTemplateId"); const requestKey = value(formData, "requestKey");
  try {
    if (!formTemplateId || !requestKey) throw new GovernedMemoryTransitionError("INVALID_INPUT");
    if (transition === "GRANT_JOURNEY_MEMORY_ROLE") {
      await grantJourneyMemoryRole({ requesterUserId: user.id, targetUserId: user.id, formTemplateId, requestKey, role: "MEMORY_STEWARD" });
    } else if (transition === "REVOKE_JOURNEY_MEMORY_ROLE" && value(formData, "renounceOwnRole") === "true") {
      await revokeJourneyMemoryRole({ requesterUserId: user.id, targetUserId: user.id, formTemplateId, requestKey, role: "MEMORY_STEWARD" });
    } else if (transition === "REVOKE_JOURNEY_MEMORY_ROLE") {
      const resolved = await resolveActiveJourneyMemoryRolePublicKey({ requesterUserId: user.id, formTemplateId, beneficiaryKey: value(formData, "beneficiaryKey") });
      if (!resolved) throw new GovernedMemoryTransitionError("NOT_FOUND");
      await revokeJourneyMemoryRole({ requesterUserId: user.id, formTemplateId, requestKey, ...resolved });
    } else if (transition === "ESTABLISH_FACT") {
      const justification = value(formData, "justification"); if (!justification) return { status: "ERROR", code: "INVALID_INPUT", message: "Une justification est requise.", fieldErrors: { justification: "Renseignez une justification." } } satisfies GovernedMemoryTransitionActionState;
      await establishJourneyFact({ requesterUserId: user.id, formTemplateId, requestKey, publicMemoryKey: value(formData, "publicMemoryKey"), concurrencyToken: value(formData, "concurrencyToken"), justification });
    } else if (transition === "DISPUTE_FACT") {
      const reason = value(formData, "reason"); if (!reason) return { status: "ERROR", code: "INVALID_INPUT", message: "Un motif est requis.", fieldErrors: { reason: "Renseignez le motif de la contestation." } } satisfies GovernedMemoryTransitionActionState;
      await disputeJourneyFact({ requesterUserId: user.id, formTemplateId, requestKey, publicMemoryKey: value(formData, "publicMemoryKey"), reason });
    } else {
      const justification = value(formData, "justification"); if (!justification) return { status: "ERROR", code: "INVALID_INPUT", message: "Une justification est requise.", fieldErrors: { justification: "Renseignez une justification." } } satisfies GovernedMemoryTransitionActionState;
      await validateJourneyDecision({ requesterUserId: user.id, formTemplateId, requestKey, publicMemoryKey: value(formData, "publicMemoryKey"), concurrencyToken: value(formData, "concurrencyToken"), justification });
    }
    revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
    return { status: "SUCCESS", transition, message: messages[transition] } satisfies GovernedMemoryTransitionActionState;
  } catch (error) {
    const state = errorState(error); if (state.status === "ERROR" && (state.code === "STATE_CONFLICT" || state.code === "ALREADY_APPLIED")) revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
    return state;
  }
}

export async function establishJourneyFactAction(_: GovernedMemoryTransitionActionState, formData: FormData) { return run(formData, "ESTABLISH_FACT"); }
export async function disputeJourneyFactAction(_: GovernedMemoryTransitionActionState, formData: FormData) { return run(formData, "DISPUTE_FACT"); }
export async function validateJourneyDecisionAction(_: GovernedMemoryTransitionActionState, formData: FormData) { return run(formData, "VALIDATE_DECISION"); }
export async function revokeJourneyMemoryRoleAction(_: GovernedMemoryTransitionActionState, formData: FormData) { return run(formData, "REVOKE_JOURNEY_MEMORY_ROLE"); }
export async function takeJourneyMemoryStewardRoleAction(_: GovernedMemoryTransitionActionState, formData: FormData) { return run(formData, "GRANT_JOURNEY_MEMORY_ROLE"); }
export async function renounceJourneyMemoryStewardRoleAction(_: GovernedMemoryTransitionActionState, formData: FormData) {
  const result = await run(formData, "REVOKE_JOURNEY_MEMORY_ROLE");
  return result.status === "SUCCESS" ? { ...result, message: "Vous n’êtes plus responsable de la mémoire. Les actions historiques restent conservées." } : result;
}
