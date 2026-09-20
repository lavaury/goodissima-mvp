import { prisma } from "@/lib/prisma";
import { getGovernancePilotage, summarizeGovernanceAttention } from "@/lib/governance-pilotage-repository";
import { toGovernanceAIAttention } from "@/lib/governance-attention";

export type GovernanceAIScope = "global" | "portfolio" | "workspace" | "journey";
export async function getGovernanceAIContext(input: { ownerId: string; scope: GovernanceAIScope; portfolioId?: string; workspaceId?: string; relationTemplateId?: string }) {
  const pilotage = await getGovernancePilotage(input.ownerId);
  const portfolios = await prisma.portfolio.findMany({ where: { ownerId: input.ownerId }, select: { id: true, name: true, status: true, workspaces: { select: { id: true, name: true } } }, take: 50 });
  const portfolio = input.portfolioId ? portfolios.find((item) => item.id === input.portfolioId) : null;
  const allowedWorkspaceIds = portfolio ? new Set(portfolio.workspaces.map((item) => item.id)) : null;
  const signals = pilotage.signals.filter((signal) => (!allowedWorkspaceIds || (signal.workspaceId && allowedWorkspaceIds.has(signal.workspaceId))) && (!input.workspaceId || signal.workspaceId === input.workspaceId)).slice(0, 100);
  const attention = summarizeGovernanceAttention({ signals, scope: input.scope === "portfolio" ? "PORTFOLIO" : input.scope === "workspace" ? "WORKSPACE" : "GLOBAL", scopeId: input.portfolioId ?? input.workspaceId, fallbackHref: input.portfolioId ? `/gouvernance/portfolios/${input.portfolioId}/pilotage` : "/gouvernance/pilotage" });
  return {
    scope: input.scope,
    portfolios: portfolios.map((item) => ({ title: item.name, status: item.status, workspaces: item.workspaces.map((workspace) => ({ title: workspace.name })) })),
    workspaces: pilotage.workspaces.filter((workspace) => !allowedWorkspaceIds || allowedWorkspaceIds.has(workspace.id)).map((workspace) => ({ title: workspace.name, status: workspace.status, portfolio: workspace.portfolio, journeyCount: workspace.journeyCount, caseCount: workspace.caseCount })),
    attention: toGovernanceAIAttention(attention),
    limits: ["Contexte compact issu des signaux déterministes Goodissima.", "Aucun token, secret, lien invité clair ou metadata technique n’est inclus.", "L’assistant ne peut effectuer aucune action."],
  };
}
