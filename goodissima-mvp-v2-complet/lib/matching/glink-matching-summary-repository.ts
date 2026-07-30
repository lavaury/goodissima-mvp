import { prisma } from "../prisma";
import { deriveGLinkMatchingSummary, type GLinkMatchingSummary } from "../glink-matching.ts";

export async function getGLinkMatchingSummariesForOwner(ownerId: string, gLinkIds: string[]) {
  const summaries = new Map<string, GLinkMatchingSummary>();
  if (gLinkIds.length === 0) return summaries;
  const runs = await prisma.matchingRun.findMany({
    where: { ownerId, gLinkId: { in: gLinkIds } },
    orderBy: [{ gLinkId: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    distinct: ["gLinkId"],
    select: {
      gLinkId: true,
      status: true,
      createdAt: true,
      completedAt: true,
      results: { select: { status: true } },
    },
  });
  for (const run of runs) summaries.set(run.gLinkId, deriveGLinkMatchingSummary(run));
  return summaries;
}
