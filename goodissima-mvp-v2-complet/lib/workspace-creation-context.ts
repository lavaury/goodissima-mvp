import { prisma } from "@/lib/prisma";
import { navigationWorkspaceSelect } from "@/lib/spatial-navigation";

/** Read-only preselection. Every creation mutation must recheck ownership and ACTIVE. */
export async function getWorkspaceCreationContext(ownerId: string, workspaceId: unknown) {
  if (typeof workspaceId !== "string" || !workspaceId.trim()) return null;
  return prisma.workspace.findFirst({ where: { id: workspaceId, ownerId, status: "ACTIVE" }, select: navigationWorkspaceSelect });
}
