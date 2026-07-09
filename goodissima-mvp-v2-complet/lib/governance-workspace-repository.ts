import { prisma } from "@/lib/prisma";

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
  href: string;
  journeyCount: number;
  relationCount: number;
  linkCount: number;
  totalObjects: number;
  state: "Actif" | "Archive";
  observation: string;
  journeys: RealGovernanceJourneySummary[];
};

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
