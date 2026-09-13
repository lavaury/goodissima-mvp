import { prisma } from "@/lib/prisma";
import type { UnreadCaseAttention } from "@/lib/notification-projection";

/** Owner-scoped tree. An inaccessible parent never makes a Workspace a root item. */
export async function getSpacesTree(ownerId: string, unreadAttention: UnreadCaseAttention[] = []) {
  const [portfolios, workspaces] = await Promise.all([
    prisma.portfolio.findMany({ where: { ownerId }, orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, status: true } }),
    prisma.workspace.findMany({ where: { ownerId }, orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, status: true, portfolioId: true,
        _count: { select: { relationTemplates: true, links: { where: { ownerId } }, relationCases: { where: { ownerId } } } } } }),
  ]);
  const decorated = workspaces.map(workspace => ({ ...workspace, unreadAttention: unreadAttention.filter(item => item.workspaceId === workspace.id) }));
  const groups = new Map(portfolios.map(portfolio => [portfolio.id, { ...portfolio, unreadCount: 0, workspaces: [] as typeof decorated }]));
  const roots: typeof decorated = [];
  let unavailableParentCount = 0;
  for (const workspace of decorated) {
    if (workspace.portfolioId === null) roots.push(workspace);
    else {
      const parent = groups.get(workspace.portfolioId);
      if (parent) { parent.workspaces.push(workspace); parent.unreadCount += workspace.unreadAttention.reduce((sum, item) => sum + item.count, 0); }
      else unavailableParentCount++;
    }
  }
  return { portfolios: [...groups.values()], roots, unavailableParentCount };
}
export type SpacesTree = Awaited<ReturnType<typeof getSpacesTree>>;
