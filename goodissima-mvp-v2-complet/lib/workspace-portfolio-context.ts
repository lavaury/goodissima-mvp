import { prisma } from "@/lib/prisma";

/** An absent context is valid; a supplied but malformed context must not silently become global. */
export function parseWorkspacePortfolioId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error("Contexte Portfolio invalide.");
  return value.trim();
}

/** Read-only preselection. The mutation must call this again before creating the Workspace. */
export async function getWorkspacePortfolioContext(ownerId: string, portfolioId: string) {
  return prisma.portfolio.findFirst({
    where: { id: portfolioId, ownerId, status: "ACTIVE" },
    select: { id: true, name: true },
  });
}
