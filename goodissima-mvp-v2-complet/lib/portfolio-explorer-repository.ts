import { prisma } from "@/lib/prisma";

/** Direct children only, with the same ownership/count rules as Mes espaces. */
export async function getPortfolioExplorer(ownerId: string, portfolioId: string) {
  return prisma.portfolio.findFirst({
    where: { id: portfolioId, ownerId },
    select: {
      id: true, name: true, status: true, description: true, kind: true, slug: true, createdAt: true,
      workspaces: {
        where: { ownerId, portfolioId }, orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, status: true,
          _count: { select: { relationTemplates: true, links: { where: { ownerId } },
            relationCases: { where: { ownerId } }, communicationSessions: { where: { ownerId } } } },
        },
      },
    },
  });
}
export type PortfolioExplorer = NonNullable<Awaited<ReturnType<typeof getPortfolioExplorer>>>;
