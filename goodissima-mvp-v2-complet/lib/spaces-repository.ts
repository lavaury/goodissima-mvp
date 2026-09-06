import { prisma } from "@/lib/prisma";

/** Owner-scoped tree. An inaccessible parent never makes a Workspace a root item. */
export async function getSpacesTree(ownerId: string) {
  const [portfolios, workspaces] = await Promise.all([
    prisma.portfolio.findMany({ where: { ownerId }, orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, status: true } }),
    prisma.workspace.findMany({ where: { ownerId }, orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, status: true, portfolioId: true,
        _count: { select: { relationTemplates: true, links: { where: { ownerId } }, relationCases: { where: { ownerId } } } } } }),
  ]);
  const groups = new Map(portfolios.map(portfolio => [portfolio.id, { ...portfolio, workspaces: [] as typeof workspaces }]));
  const roots: typeof workspaces = [];
  let unavailableParentCount = 0;
  for (const workspace of workspaces) {
    if (workspace.portfolioId === null) roots.push(workspace);
    else {
      const parent = groups.get(workspace.portfolioId);
      if (parent) parent.workspaces.push(workspace);
      else unavailableParentCount++;
    }
  }
  return { portfolios: [...groups.values()], roots, unavailableParentCount };
}
export type SpacesTree = Awaited<ReturnType<typeof getSpacesTree>>;
