import { prisma } from "@/lib/prisma";
import {
  archivedAnnouncementWhere,
  archivedJourneyWhere,
  archivedOpportunityCount,
} from "@/lib/archived-opportunity";

export async function getArchivedOpportunitySummaryForOwner(ownerId: string, templateId?: string) {
  const [announcementCount, journeys] = await prisma.$transaction(
    [
      prisma.gLink.count({ where: archivedAnnouncementWhere(ownerId, templateId) }),
      prisma.relationTemplate.findMany({
        where: archivedJourneyWhere(ownerId, templateId),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          formTemplates: { select: { id: true }, take: 1 },
          _count: { select: { links: true } },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );

  return {
    count: archivedOpportunityCount(announcementCount, journeys.length),
    journeys,
  };
}
