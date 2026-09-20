import { GovernancePilotageAssistant } from "@/components/GovernancePilotageAssistant";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getGovernancePortfolioSummaries } from "@/lib/governance-portfolio-repository";
export async function GovernancePilotageAssistantSection() {
  const owner = await getCurrentPrismaUser();
  const portfolios = await getGovernancePortfolioSummaries(owner.id);
  return <div data-boussole-id="pilotage-assistant"><GovernancePilotageAssistant portfolios={portfolios.map((portfolio) => ({ id: portfolio.id, title: portfolio.name }))} /></div>;
}
