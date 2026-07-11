"use server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getGovernanceAIContext, type GovernanceAIScope } from "@/lib/governance-ai-context-repository";
import { generateGovernancePilotageBrief, type GovernanceAIMode, type GovernancePilotageBrief } from "@/lib/governance-ai-assistant";
export async function generateGovernancePilotageBriefAction(input: { scope: GovernanceAIScope; mode: GovernanceAIMode; portfolioId?: string }): Promise<{ brief?: GovernancePilotageBrief; error?: string }> {
  const owner = await getCurrentPrismaUser();
  if (!( ["global", "portfolio", "workspace", "journey"] as string[]).includes(input.scope) || !( ["summary", "priorities", "blockers", "meetingBrief"] as string[]).includes(input.mode)) return { error: "Demande d’assistance invalide." };
  try { const context = await getGovernanceAIContext({ ownerId: owner.id, scope: input.scope, portfolioId: input.portfolioId }); return { brief: await generateGovernancePilotageBrief({ scope: input.scope, mode: input.mode, context }) }; }
  catch (error) { if (error instanceof Error && error.message === "MISTRAL_CONFIGURATION_MISSING") return { error: "Assistant indisponible : configuration Mistral absente." }; if (error instanceof Error && error.message === "AI_REAL_PROVIDER_MISSING") return { error: "Assistant indisponible : aucun fournisseur IA réel configuré." }; return { error: "Assistant momentanément indisponible." }; }
}
