import type { PortfolioKind, PortfolioStatus, WorkspaceCategory, WorkspaceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { workspaceCategoryLabels, workspaceKindLabels } from "@/lib/governance-workspace-repository";

export const portfolioKindLabels: Record<PortfolioKind, string> = {
  JUDICIAL: "Judiciaire",
  PROFESSIONAL: "Professionnel",
  ASSOCIATION: "Association",
  FAMILY: "Famille",
  PROJECT: "Projet",
  PERSONAL: "Personnel",
  OTHER: "Autre",
};

export const portfolioStatusLabels: Record<PortfolioStatus, string> = {
  ACTIVE: "Actif",
  ARCHIVED: "Archive",
};

export type GovernancePortfolioWorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  category: WorkspaceCategory;
  categoryLabel: string;
  kind: WorkspaceKind;
  kindLabel: string;
  href: string;
  journeyCount: number;
  gLinkCount: number;
  relationCaseCount: number;
  communicationSessionCount: number;
};

export type GovernancePortfolioSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: PortfolioKind;
  kindLabel: string;
  status: PortfolioStatus;
  statusLabel: string;
  createdAt: Date;
  workspaceCount: number;
  journeyCount: number;
  gLinkCount: number;
  relationCaseCount: number;
  communicationSessionCount: number;
  totalObjectCount: number;
  workspaces: GovernancePortfolioWorkspaceSummary[];
};

export type GovernancePortfolioWorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  categoryLabel: string;
  kindLabel: string;
};

function firstWorkspaceHref(workspace: {
  relationTemplates: Array<{
    formTemplates: Array<{ id: string }>;
  }>;
}) {
  const formTemplateId = workspace.relationTemplates
    .flatMap((template) => template.formTemplates)
    .at(0)?.id;
  return formTemplateId ? `/gouvernance/parcours/${formTemplateId}/pilotage` : "/gouvernance";
}

function workspaceSummary(workspace: {
  id: string;
  slug: string;
  name: string;
  category: WorkspaceCategory;
  kind: WorkspaceKind;
  relationTemplates: Array<{ formTemplates: Array<{ id: string }> }>;
  _count: {
    relationTemplates: number;
    links: number;
    relationCases: number;
    communicationSessions: number;
  };
}): GovernancePortfolioWorkspaceSummary {
  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    category: workspace.category,
    categoryLabel: workspaceCategoryLabels[workspace.category],
    kind: workspace.kind,
    kindLabel: workspaceKindLabels[workspace.kind],
    href: firstWorkspaceHref(workspace),
    journeyCount: workspace._count.relationTemplates,
    gLinkCount: workspace._count.links,
    relationCaseCount: workspace._count.relationCases,
    communicationSessionCount: workspace._count.communicationSessions,
  };
}

function portfolioSummary(portfolio: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: PortfolioKind;
  status: PortfolioStatus;
  createdAt: Date;
  workspaces: Array<Parameters<typeof workspaceSummary>[0]>;
}): GovernancePortfolioSummary {
  const workspaces = portfolio.workspaces.map(workspaceSummary);
  const journeyCount = workspaces.reduce((total, workspace) => total + workspace.journeyCount, 0);
  const gLinkCount = workspaces.reduce((total, workspace) => total + workspace.gLinkCount, 0);
  const relationCaseCount = workspaces.reduce((total, workspace) => total + workspace.relationCaseCount, 0);
  const communicationSessionCount = workspaces.reduce((total, workspace) => total + workspace.communicationSessionCount, 0);

  return {
    id: portfolio.id,
    slug: portfolio.slug,
    name: portfolio.name,
    description: portfolio.description,
    kind: portfolio.kind,
    kindLabel: portfolioKindLabels[portfolio.kind],
    status: portfolio.status,
    statusLabel: portfolioStatusLabels[portfolio.status],
    createdAt: portfolio.createdAt,
    workspaceCount: workspaces.length,
    journeyCount,
    gLinkCount,
    relationCaseCount,
    communicationSessionCount,
    totalObjectCount: workspaces.length + journeyCount + gLinkCount + relationCaseCount + communicationSessionCount,
    workspaces,
  };
}

const portfolioInclude = {
  workspaces: {
    orderBy: { createdAt: "desc" as const },
    include: {
      relationTemplates: {
        orderBy: { createdAt: "desc" as const },
        include: {
          formTemplates: {
            orderBy: { createdAt: "asc" as const },
            select: { id: true },
          },
        },
      },
      _count: {
        select: {
          relationTemplates: true,
          links: true,
          relationCases: true,
          communicationSessions: true,
        },
      },
    },
  },
};

export async function getGovernancePortfolioSummaries(ownerId: string): Promise<GovernancePortfolioSummary[]> {
  const portfolios = await prisma.portfolio.findMany({
    where: { ownerId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: portfolioInclude,
  });

  return portfolios.map(portfolioSummary);
}

export async function getGovernancePortfolioDetail(input: {
  ownerId: string;
  portfolioId: string;
}): Promise<GovernancePortfolioSummary | null> {
  const portfolio = await prisma.portfolio.findFirst({
    where: {
      id: input.portfolioId,
      ownerId: input.ownerId,
    },
    include: portfolioInclude,
  });

  return portfolio ? portfolioSummary(portfolio) : null;
}

export async function getAvailableWorkspacesForPortfolio(ownerId: string): Promise<GovernancePortfolioWorkspaceOption[]> {
  const workspaces = await prisma.workspace.findMany({
    where: {
      ownerId,
      status: "ACTIVE",
      portfolioId: null,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      kind: true,
    },
  });

  return workspaces.map((workspace) => ({
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    categoryLabel: workspaceCategoryLabels[workspace.category],
    kindLabel: workspaceKindLabels[workspace.kind],
  }));
}
