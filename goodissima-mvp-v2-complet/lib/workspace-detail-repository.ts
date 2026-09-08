import { prisma } from "@/lib/prisma";

/** Explorer uses direct foreign keys only. Never infer membership from a parent object. */
export async function getWorkspaceDetail(ownerId: string, workspaceId: string) {
  return prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId },
    select: {
      id: true, name: true, ownerId: true, description: true, category: true, kind: true, status: true,
      portfolio: { select: { id: true, name: true, ownerId: true } },
      relationTemplates: {
        where: { workspaceId }, orderBy: { createdAt: "desc" },
        select: { id: true, name: true, status: true, formTemplates: {
          orderBy: { createdAt: "asc" }, take: 1, select: { id: true, name: true },
        } },
      },
      links: {
        where: { workspaceId, ownerId }, orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, rules: true },
      },
      relationCases: {
        where: { workspaceId, ownerId }, orderBy: { createdAt: "desc" },
        select: { id: true, candidateName: true, status: true, gLink: { select: { title: true } } },
      },
    },
  });
}
export type WorkspaceDetail = NonNullable<Awaited<ReturnType<typeof getWorkspaceDetail>>>;
