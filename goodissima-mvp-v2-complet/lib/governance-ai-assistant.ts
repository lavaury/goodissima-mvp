import { getAIProvider } from "@/lib/ai-runtime";
import { getConfiguredAIProvider } from "@/lib/ai/service";
import type { GovernanceAIScope } from "@/lib/governance-ai-context-repository";
export type GovernanceAIMode = "summary" | "priorities" | "blockers" | "meetingBrief";
export type GovernancePilotageBrief = { summary: string; priorities: Array<{ title: string; reason: string; humanAction: string; targetUrl: string | null }>; blockers: Array<{ title: string; reason: string; targetUrl: string | null }>; suggestedNextSteps: string[]; limits: string[] };
function text(value: unknown, max = 1000) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : ""; }
function internalUrl(value: unknown) { const url = text(value, 500); return url.startsWith("/") && !url.includes("token=") ? url : null; }
function parseBrief(content: string): GovernancePilotageBrief {
  const parsed = JSON.parse(content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>;
  const priorities = Array.isArray(parsed.priorities) ? parsed.priorities.slice(0, 12).map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {}).map((item) => ({ title: text(item.title, 180), reason: text(item.reason, 800), humanAction: text(item.humanAction, 300), targetUrl: internalUrl(item.targetUrl) })).filter((item) => item.title && item.reason && item.humanAction) : [];
  const blockers = Array.isArray(parsed.blockers) ? parsed.blockers.slice(0, 12).map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {}).map((item) => ({ title: text(item.title, 180), reason: text(item.reason, 800), targetUrl: internalUrl(item.targetUrl) })).filter((item) => item.title && item.reason) : [];
  return { summary: text(parsed.summary, 2400) || "Aucune synthèse disponible.", priorities, blockers, suggestedNextSteps: Array.isArray(parsed.suggestedNextSteps) ? parsed.suggestedNextSteps.map((item) => text(item, 500)).filter(Boolean).slice(0, 12) : [], limits: Array.isArray(parsed.limits) ? parsed.limits.map((item) => text(item, 500)).filter(Boolean).slice(0, 12) : [] };
}
export async function generateGovernancePilotageBrief(input: { scope: GovernanceAIScope; mode: GovernanceAIMode; context: unknown }): Promise<GovernancePilotageBrief> {
  if (getAIProvider() !== "mistral") throw new Error("AI_REAL_PROVIDER_MISSING");
  if (!process.env.MISTRAL_API_KEY) throw new Error("MISTRAL_CONFIGURATION_MISSING");
  const provider = getConfiguredAIProvider();
  if (provider.name !== "mistral") throw new Error("AI_REAL_PROVIDER_MISSING");
  const result = await provider.chat({ system: ["Tu es l'assistant de pilotage Goodissima.", "Utilise exclusivement le contexte JSON fourni et n'invente aucune donnée.", "Propose uniquement des actions humaines et ne prétends jamais avoir exécuté une action.", "Retourne un objet JSON strict sans markdown avec summary, priorities, blockers, suggestedNextSteps, limits.", "Chaque priorité contient title, reason, humanAction, targetUrl. Chaque blocage contient title, reason, targetUrl.", "Les targetUrl proviennent du contexte et sont des chemins internes commençant par /.", "N'inclus aucun secret, token, lien invité ou metadata technique."].join("\n"), prompt: JSON.stringify({ scope: input.scope, mode: input.mode, context: input.context }), metadata: { feature: "governance_pilotage_assistant", mode: input.mode, scope: input.scope } });
  try { return parseBrief(result.output); } catch { throw new Error("MISTRAL_INVALID_GOVERNANCE_JSON"); }
}
