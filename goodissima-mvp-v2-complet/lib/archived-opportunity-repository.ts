import { prisma } from "@/lib/prisma";
import { getAccessibleRelationTemplateIds } from "@/lib/relation-template-access";
import {
  archivedAnnouncementWhere,
  archivedJourneyWhere,
  archivedOpportunityCount,
} from "@/lib/archived-opportunity";

export async function getArchivedOpportunitySummaryForOwner(ownerId: string, templateId?: string) {
  const readableIds = await getAccessibleRelationTemplateIds(ownerId);
  const [announcementCount, journeys] = await prisma.$transaction(
    [
      prisma.gLink.count({ where: archivedAnnouncementWhere(ownerId, templateId) }),
      prisma.relationTemplate.findMany({
        where: { AND: [archivedJourneyWhere(ownerId, templateId), { id: { in: readableIds } }] },
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
