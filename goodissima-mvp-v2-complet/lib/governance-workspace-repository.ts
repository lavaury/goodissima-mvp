import { prisma } from "@/lib/prisma";
import type { WorkspaceCategory, WorkspaceKind } from "@prisma/client";

export const workspaceCategoryLabels: Record<WorkspaceCategory, string> = {
  PROFESSIONAL: "Professionnel",
  PRIVATE: "Prive",
  FAMILY: "Famille",
  ASSOCIATION: "Association",
  PROJECT: "Projet",
  CLIENT: "Client",
  OTHER: "Autre",
};

export const workspaceKindLabels: Record<WorkspaceKind, string> = {
  GOVERNANCE: "Gouvernance",
  RELATION: "Relation",
  MIXED: "Mixte",
};

export type RealGovernanceJourneySummary = {
  relationTemplateId: string;
  formTemplateId: string | null;
  name: string;
  href: string | null;
};

export type RealGovernanceWorkspaceSummary = {
  workspaceId: string;
  slug: string;
  name: string;
  category: WorkspaceCategory;
  categoryLabel: string;
  kind: WorkspaceKind;
  kindLabel: string;
  href: string;
  journeyCount: number;
  relationCount: number;
  linkCount: number;
  totalObjects: number;
  state: "Actif" | "Archive";
  observation: string;
  journeys: RealGovernanceJourneySummary[];
};

export type GovernanceWorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  categoryLabel: string;
  kindLabel: string;
};

export async function getGovernanceWorkspaceOptions(ownerId: string): Promise<GovernanceWorkspaceOption[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId, status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      kind: true,
    },
  });

  return workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    categoryLabel: workspaceCategoryLabels[workspace.category],
    kindLabel: workspaceKindLabels[workspace.kind],
  }));
}

export async function getRealGovernanceWorkspaceSummaries(ownerId: string): Promise<RealGovernanceWorkspaceSummary[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      relationTemplates: {
        orderBy: { createdAt: "desc" },
        include: {
          formTemplates: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          relationTemplates: true,
          relationCases: true,
          links: true,
        },
      },
    },
  });

  return workspaces.map((workspace) => {
    const journeys = workspace.relationTemplates.map((template) => {
      const formTemplate = template.formTemplates[0] ?? null;

      return {
        relationTemplateId: template.id,
        formTemplateId: formTemplate?.id ?? null,
        name: formTemplate?.name ?? template.name,
        href: formTemplate ? `/gouvernance/parcours/${formTemplate.id}/pilotage` : null,
      };
    });
    const totalObjects = workspace._count.relationTemplates + workspace._count.relationCases + workspace._count.links;
    const firstJourneyHref = journeys.find((journey) => journey.href)?.href;

    return {
      workspaceId: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      category: workspace.category,
      categoryLabel: workspaceCategoryLabels[workspace.category],
      kind: workspace.kind,
      kindLabel: workspaceKindLabels[workspace.kind],
      href: firstJourneyHref ?? "/gouvernance",
      journeyCount: workspace._count.relationTemplates,
      relationCount: workspace._count.relationCases,
      linkCount: workspace._count.links,
      totalObjects,
      state: workspace.status === "ARCHIVED" ? "Archive" : "Actif",
      observation:
        totalObjects > 0
          ? "Workspace persistant rattache a des objets Goodissima."
          : "Workspace persistant sans objet rattache pour le moment.",
      journeys,
    };
  });
}
