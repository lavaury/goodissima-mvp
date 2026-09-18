"use server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getGovernanceAIContext, type GovernanceAIScope } from "@/lib/governance-ai-context-repository";
import { generateGovernancePilotageBrief, type GovernanceAIMode, type GovernancePilotageBrief } from "@/lib/governance-ai-assistant";
import { getAIUserError } from "@/lib/ai/governance/router";
export async function generateGovernancePilotageBriefAction(input: { scope: GovernanceAIScope; mode: GovernanceAIMode; portfolioId?: string }): Promise<{ brief?: GovernancePilotageBrief; error?: string }> {
  const owner = await getCurrentPrismaUser();
  if (!( ["global", "portfolio", "workspace", "journey"] as string[]).includes(input.scope) || !( ["summary", "priorities", "blockers", "meetingBrief"] as string[]).includes(input.mode)) return { error: "Demande d’assistance invalide." };
  try { const context = await getGovernanceAIContext({ ownerId: owner.id, scope: input.scope, portfolioId: input.portfolioId }); return { brief: await generateGovernancePilotageBrief({ scope: input.scope, mode: input.mode, context, actorId: owner.id }) }; }
  catch (error) { return { error: getAIUserError(error) }; }
}
