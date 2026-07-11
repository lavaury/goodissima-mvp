import { prisma } from "@/lib/prisma";
import { getGovernancePilotage } from "@/lib/governance-pilotage-repository";

export type GovernanceAIScope = "global" | "portfolio" | "workspace" | "journey";
export async function getGovernanceAIContext(input: { ownerId: string; scope: GovernanceAIScope; portfolioId?: string; workspaceId?: string; relationTemplateId?: string }) {
  const pilotage = await getGovernancePilotage(input.ownerId);
  const portfolios = await prisma.portfolio.findMany({ where: { ownerId: input.ownerId }, select: { id: true, name: true, status: true, workspaces: { select: { id: true, name: true } } }, take: 50 });
  const portfolio = input.portfolioId ? portfolios.find((item) => item.id === input.portfolioId) : null;
  const allowedWorkspaceNames = portfolio ? new Set(portfolio.workspaces.map((item) => item.name)) : null;
  const signals = pilotage.signals.filter((signal) => (!allowedWorkspaceNames || (signal.workspace && allowedWorkspaceNames.has(signal.workspace))) && (!input.workspaceId || pilotage.workspaces.find((workspace) => workspace.id === input.workspaceId)?.name === signal.workspace)).slice(0, 100);
  return {
    scope: input.scope,
    portfolios: portfolios.map((item) => ({ id: item.id, title: item.name, status: item.status, workspaces: item.workspaces.map((workspace) => ({ id: workspace.id, title: workspace.name })) })),
    workspaces: pilotage.workspaces.filter((workspace) => !allowedWorkspaceNames || allowedWorkspaceNames.has(workspace.name)).map((workspace) => ({ id: workspace.id, title: workspace.name, status: workspace.status, portfolio: workspace.portfolio, journeyCount: workspace.journeyCount, caseCount: workspace.caseCount })),
    signals: signals.map((signal) => ({ title: signal.title, subject: signal.subject, journey: signal.journey, workspace: signal.workspace, portfolio: signal.portfolio, reason: signal.reason, humanAction: signal.actionLabel, targetUrl: signal.href, date: signal.date?.toISOString() ?? null })),
    limits: ["Contexte compact issu des signaux déterministes Goodissima.", "Aucun token, secret, lien invité clair ou metadata technique n’est inclus.", "L’assistant ne peut effectuer aucune action."],
  };
}
