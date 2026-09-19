import { routeAI } from "./router.ts";
import { AIGovernanceError } from "./types.ts";
import type { AIExecutionProvenance, AIDataClassification } from "./types.ts";

export const JOURNEY_STRUCTURE_PROMPT_VERSION = "governed-journey-structure-v1";

type Structure = {
  name: string;
  objective: string;
  actors: Array<{ name: string; role: string }>;
  documents: Array<{ name: string; required: boolean }>;
  firstActions: Array<{ title: string; owner: string }>;
};

const sensitivePattern = /(?:santé|medical|médical|diagnostic|handicap|religion|syndicat|orientation sexuelle|casier judiciaire|bank account|iban)/i;
const secretPattern = /(?:bearer\s+[a-z0-9._~-]+|\bsk-[a-z0-9_-]{12,}|(?:api[_ -]?key|token|secret|password|credential)\s*[:=]\s*\S+)/gi;
const emailPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const jwtPattern = /\beyJ[a-z0-9_-]+\.eyJ[a-z0-9_-]+\.[a-z0-9_-]+\b/gi;

function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  return value.trim();
}

function records(value: unknown, max: number): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  return value as Record<string, unknown>[];
}

export function validateJourneyStructure(output: string): Structure {
  let parsed: unknown;
  try { parsed = JSON.parse(output.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")); }
  catch { throw new AIGovernanceError("AI_OUTPUT_INVALID"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  const value = parsed as Record<string, unknown>;
  return {
    name: text(value.name, 120), objective: text(value.objective, 2_000),
    actors: records(value.actors, 20).map((actor) => ({ name: text(actor.name, 160), role: text(actor.role, 300) })),
    documents: records(value.documents, 30).map((document) => ({ name: text(document.name, 160), required: document.required === true })),
    firstActions: records(value.firstActions, 20).map((action) => ({ title: text(action.title, 240), owner: text(action.owner, 160) })),
  };
}

export function prepareJourneyCreationNeed(description: string): { need: string; classification: AIDataClassification } {
  if (description.length < 20 || description.length > 5_000) throw new AIGovernanceError("AI_CONTEXT_INVALID");
  const classification: AIDataClassification = sensitivePattern.test(description) ? "SENSITIVE" : "CONFIDENTIAL";
  const need = description.replace(secretPattern, "[REDACTED]").replace(jwtPattern, "[REDACTED]").replace(emailPattern, "[REDACTED_EMAIL]").replace(uuidPattern, "[REDACTED_ID]");
  if (new RegExp(secretPattern.source, "i").test(need) || new RegExp(emailPattern.source, "i").test(need) || new RegExp(uuidPattern.source, "i").test(need) || new RegExp(jwtPattern.source, "i").test(need)) throw new AIGovernanceError("AI_CONTEXT_INVALID");
  return { need, classification };
}

export async function proposeJourneyStructure(description: string, actorId: string): Promise<{ draft: Structure; provenance: AIExecutionProvenance }> {
  const prepared = prepareJourneyCreationNeed(description);
  const result = await routeAI({
    capability: "proposeJourneyStructure", context: { type: "JOURNEY_CREATION_NEED", data: {} },
    classification: prepared.classification, actorId, ownerId: actorId,
    purpose: "propose_governed_journey_structure", promptVersion: JOURNEY_STRUCTURE_PROMPT_VERSION,
    system: "Propose un cadrage initial de Parcours Goodissima en français. Réponds uniquement en JSON strict : {name,objective,actors:[{name,role}],documents:[{name,required}],firstActions:[{title,owner}]}. Les actors sont des rôles, profils ou responsabilités à prévoir, jamais des personnes identifiées. Le résultat est un plan initial soumis à validation humaine ; ne prétends créer ni invitation, ni accès, ni document reçu, ni règle technique.",
    prompt: { need: prepared.need }, responseFormat: { type: "json_object" },
    validateOutput: validateJourneyStructure,
  });
  return { draft: result.output, provenance: result.provenance };
}
