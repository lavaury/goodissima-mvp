import { AIGovernanceError } from "./types.ts";
import type { PreparedAuthorizedAIContext } from "./context.ts";

export const CURRENT_STATE_EXPLAIN_PROMPT_VERSION = "governed-current-state-explain-v1";
export const EMPTY_CURRENT_STATE_EXPLANATION = "Le Parcours ne contient pas encore suffisamment d’éléments gouvernés pour produire une explication utile.";

type State = {
  decisions: { count: number } | null;
  facts: { establishedCount: number; disputedCount: number } | null;
  sources: { activeCount: number } | null;
  peopleAndRoles: { participantCount: number; activeRoleCount: number; vacantRoleCount: number } | null;
  clarifications: Array<{ kind: string; count: number; label: string }>;
  nextMeeting: { scheduledAt: string } | null;
};

export function currentStateFromContext(prepared: PreparedAuthorizedAIContext): State {
  if (prepared.capability !== "explainCurrentState" || prepared.authorizationScope !== "SINGLE_EXECUTION") throw new AIGovernanceError("AI_CONTEXT_INVALID");
  const data = prepared.context.data as { TRUSTED_SYSTEM_CONTEXT?: { currentState?: State } };
  if (!data.TRUSTED_SYSTEM_CONTEXT?.currentState) throw new AIGovernanceError("AI_CONTEXT_INVALID");
  return data.TRUSTED_SYSTEM_CONTEXT.currentState;
}

export function currentStateIsEmpty(state: State) {
  return !state.decisions && !state.facts && !state.sources && !state.peopleAndRoles && !state.clarifications.length && !state.nextMeeting;
}

export function allowedCurrentStateStatements(state: State): string[] {
  const statements: string[] = [];
  const count = state.decisions?.count ?? 0;
  if (count) statements.push(`${count === 1 ? "Une décision est actuellement en vigueur" : `${count} décisions sont actuellement en vigueur`}.`);
  const established = state.facts?.establishedCount ?? 0;
  const disputed = state.facts?.disputedCount ?? 0;
  if (established) statements.push(`${established === 1 ? "Un fait est établi" : `${established} faits sont établis`} dans la mémoire gouvernée.`);
  if (disputed) statements.push(`${disputed === 1 ? "Un fait est actuellement contesté" : `${disputed} faits sont actuellement contestés`}.`);
  const people = state.peopleAndRoles;
  if (people?.participantCount) statements.push(`${people.participantCount === 1 ? "Un participant est actuellement actif" : `${people.participantCount} participants sont actuellement actifs`}.`);
  if (people?.activeRoleCount) statements.push(`${people.activeRoleCount === 1 ? "Un rôle est actuellement occupé" : `${people.activeRoleCount} rôles sont actuellement occupés`}.`);
  if (people?.vacantRoleCount) statements.push(`${people.vacantRoleCount === 1 ? "Un rôle reste à pourvoir" : `${people.vacantRoleCount} rôles restent à pourvoir`}.`);
  if (state.sources?.activeCount) statements.push(`${state.sources.activeCount === 1 ? "Une source active est visible" : `${state.sources.activeCount} sources actives sont visibles`}.`);
  for (const item of state.clarifications) {
    const safe = item.label.trim().replace(/[.!?]+$/, "");
    if (safe && item.count > 0) statements.push(`${safe}.`);
  }
  if (state.nextMeeting) statements.push("Une prochaine réunion est planifiée.");
  return statements;
}

export function validateCurrentStateExplanation(output: string, allowed: readonly string[]) {
  let parsed: unknown;
  try { parsed = JSON.parse(output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")); }
  catch { throw new AIGovernanceError("AI_OUTPUT_INVALID"); }
  const row = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  if (!row || !Array.isArray(row.statements) || row.statements.length < 1 || row.statements.length > 6 || row.statements.some((item) => typeof item !== "string" || !allowed.includes(item))) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  const unique = [...new Set(row.statements as string[])];
  if (unique.length !== row.statements.length) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  return unique.join(" ");
}

export const CURRENT_STATE_EXPLAIN_SYSTEM = [
  "Tu expliques uniquement l'état gouverné du Parcours fourni par Goodissima.",
  "Ne recalcule aucun compteur, ne déduis aucun fait absent et ne consulte aucun Journal.",
  "Ne juge pas la qualité des décisions, des faits, du groupe ou le niveau de risque.",
  "Une contestation ne signifie pas qu'un fait est faux ni qu'une décision est annulée.",
  "Ne recommande aucune action et ne mentionne aucune identité ni source absente du contexte.",
  "Retourne uniquement un JSON {\"statements\":[...]} contenant entre 1 et 6 phrases copiées exactement depuis allowedStatements, sans texte libre.",
].join("\n");
