import { GovernancePilotageAssistant } from "@/components/GovernancePilotageAssistant";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getGovernanceAIContext } from "@/lib/governance-ai-context-repository";
export async function GovernancePilotageAssistantSection() {
  const owner = await getCurrentPrismaUser();
  const context = await getGovernanceAIContext({ ownerId: owner.id, scope: "global" });
  return <GovernancePilotageAssistant portfolios={context.portfolios.map((portfolio) => ({ id: portfolio.id, title: portfolio.title }))} />;
}
