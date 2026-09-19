import { routeAI } from "./router.ts";
import { AIGovernanceError } from "./types.ts";
import type { AIDataClassification, AIExecutionProvenance } from "./types.ts";
import { HOME_INTENTS } from "../../home-intent.ts";
import type { HomeIntent, HomeActionIntent } from "../../home-intent.ts";

export const HOME_INTENT_PROMPT_VERSION = "home-intent-v1";
export type InterpretedHomeIntent = {
  intent: HomeIntent;
  reformulation: string;
  confidenceBand: "HIGH" | "MEDIUM" | "LOW";
  proposedParameters: { need?: string; query?: string; objectQuery?: string };
  ambiguityOptions?: HomeActionIntent[];
};

const sensitivePattern = /(?:santé|médical|diagnostic|handicap|religion|syndicat|orientation sexuelle|casier judiciaire|iban)/i;
const secretPattern = /(?:bearer\s+[a-z0-9._~-]+|\bsk-[a-z0-9_-]{12,}|(?:api[_ -]?key|token|secret|password|credential)\s*[:=]\s*\S+)/gi;
const emailPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const urlPattern = /(?:https?:\/\/|www\.)\S+/gi;
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const jwtPattern = /\beyJ[a-z0-9_-]+\.eyJ[a-z0-9_-]+\.[a-z0-9_-]+\b/gi;
const internalTerms = /goodissima|mistral|openai|chatgpt|prisma|governedjourney|journeyconsent|roledefinition|communicationsession|governedmemory|mémoire gouvernée|provider|deployment|module|workflow/gi;
const unsafeOutput = /(?:https?:\/\/|www\.|\/api\/|\/gouvernance\/|\/annuaire\b|\brm\s+-rf\b|\bdrop\s+table\b|\bcurl\s+https?:)/i;
const creationIntents = new Set<HomeIntent>(["CREATE_GOVERNED_JOURNEY", "CREATE_SIMPLE_LINK", "CREATE_OPPORTUNITY"]);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  return value as Record<string, unknown>;
}
function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new AIGovernanceError("AI_OUTPUT_INVALID");
}
function boundedText(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max || unsafeOutput.test(value)) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  return value.trim();
}

export function prepareHomeIntentText(value: string): { text: string; classification: AIDataClassification } {
  if (typeof value !== "string" || value.trim().length < 3 || value.length > 500) throw new AIGovernanceError("AI_CONTEXT_INVALID");
  const classification: AIDataClassification = sensitivePattern.test(value) ? "SENSITIVE" : "CONFIDENTIAL";
  const text = value.trim().replace(secretPattern, "[REDACTED]").replace(jwtPattern, "[REDACTED]").replace(emailPattern, "[REDACTED_EMAIL]").replace(urlPattern, "[REDACTED_URL]").replace(uuidPattern, "[REDACTED_ID]");
  return { text, classification };
}

export function validateHomeIntentOutput(output: string, userText: string): InterpretedHomeIntent {
  let parsed: unknown;
  try { parsed = JSON.parse(output.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")); }
  catch { throw new AIGovernanceError("AI_OUTPUT_INVALID"); }
  const row = object(parsed);
  onlyKeys(row, ["intent", "reformulation", "confidenceBand", "proposedParameters", "ambiguityOptions"]);
  if (typeof row.intent !== "string" || !HOME_INTENTS.includes(row.intent as HomeIntent)) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  const intent = row.intent as HomeIntent;
  const reformulation = boundedText(row.reformulation, 400);
  for (const marker of reformulation.match(internalTerms) ?? []) if (!userText.toLocaleLowerCase("fr").includes(marker.toLocaleLowerCase("fr"))) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  if (row.confidenceBand !== "HIGH" && row.confidenceBand !== "MEDIUM" && row.confidenceBand !== "LOW") throw new AIGovernanceError("AI_OUTPUT_INVALID");
  const parameters = object(row.proposedParameters);
  const allowedParameters = creationIntents.has(intent) ? ["need"] : intent === "SEARCH_DIRECTORY" ? ["query"] : intent === "OPEN_EXISTING_OBJECT" ? ["objectQuery"] : [];
  onlyKeys(parameters, allowedParameters);
  const proposedParameters: InterpretedHomeIntent["proposedParameters"] = {};
  for (const key of allowedParameters as Array<keyof typeof proposedParameters>) {
    if (parameters[key] !== undefined) proposedParameters[key] = boundedText(parameters[key], 500);
  }
  let ambiguityOptions: HomeActionIntent[] | undefined;
  if (intent === "AMBIGUOUS") {
    if (!Array.isArray(row.ambiguityOptions) || row.ambiguityOptions.length < 2 || row.ambiguityOptions.length > 3) throw new AIGovernanceError("AI_OUTPUT_INVALID");
    if (row.ambiguityOptions.some((item) => typeof item !== "string" || !HOME_INTENTS.includes(item as HomeIntent) || ["UNKNOWN", "AMBIGUOUS", "OPEN_EXISTING_OBJECT"].includes(item))) throw new AIGovernanceError("AI_OUTPUT_INVALID");
    ambiguityOptions = [...new Set(row.ambiguityOptions)] as HomeActionIntent[];
    if (ambiguityOptions.length < 2) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  } else if (row.ambiguityOptions !== undefined) throw new AIGovernanceError("AI_OUTPUT_INVALID");
  return { intent, reformulation, confidenceBand: row.confidenceBand, proposedParameters, ...(ambiguityOptions ? { ambiguityOptions } : {}) };
}

export const HOME_INTENT_SYSTEM = "Interprète une seule intention d'accueil en français. Réponds uniquement en JSON strict : {intent,reformulation,confidenceBand,proposedParameters,ambiguityOptions?}. intent doit être l'un de RESUME_WORK, CREATE_GOVERNED_JOURNEY, CREATE_SIMPLE_LINK, CREATE_OPPORTUNITY, SEARCH_DIRECTORY, OPEN_MY_SPACES, OPEN_EXISTING_OBJECT, UNKNOWN, AMBIGUOUS. confidenceBand est HIGH, MEDIUM ou LOW. proposedParameters contient uniquement need pour une création, query pour SEARCH_DIRECTORY, objectQuery pour OPEN_EXISTING_OBJECT, ou est vide. AMBIGUOUS fournit 2 ou 3 ambiguityOptions parmi les intentions fonctionnelles connues ; ne choisis pas arbitrairement. Ne fournis jamais URL, route, objectId, commande ni permission. Reformule dans le langage métier de l'utilisateur sans nom de produit, module ou provider, sauf s'il l'a demandé. Exemples : « Créer un comité de voyage Europe-Asie » → CREATE_GOVERNED_JOURNEY ; « Chercher les anciens de ma promo 1957 » → SEARCH_DIRECTORY avec query textuelle, sans supposer que le critère promotion existe ; « Créer un lien avec Paul » → CREATE_SIMPLE_LINK ; « Je cherche un expert cybersécurité » → SEARCH_DIRECTORY ; « Reprendre où j'en étais » → RESUME_WORK ; « Je veux trouver des experts et travailler avec eux » → AMBIGUOUS avec SEARCH_DIRECTORY et CREATE_OPPORTUNITY. En cas d'incertitude, choisis UNKNOWN.";

export async function interpretHomeIntent(text: string, actorId: string): Promise<{ interpretation: InterpretedHomeIntent; provenance: AIExecutionProvenance }> {
  const prepared = prepareHomeIntentText(text);
  const result = await routeAI({
    capability: "interpretHomeIntent", context: { type: "HOME_INTENT", data: {} }, classification: prepared.classification,
    actorId, ownerId: actorId, purpose: "interpret_home_navigation", promptVersion: HOME_INTENT_PROMPT_VERSION,
    system: HOME_INTENT_SYSTEM, prompt: { text: prepared.text }, responseFormat: { type: "json_object" },
    validateOutput: (output) => validateHomeIntentOutput(output, prepared.text),
  });
  return { interpretation: result.output, provenance: result.provenance };
}
