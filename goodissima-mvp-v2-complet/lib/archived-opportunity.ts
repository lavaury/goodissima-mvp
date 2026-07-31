export function archivedAnnouncementWhere(ownerId: string, templateId?: string) {
  return {
    ownerId,
    status: "ARCHIVED" as const,
    ...(templateId ? { templateId } : {}),
  };
}

export function archivedJourneyWhere(ownerId: string, templateId?: string) {
  return {
    status: "ARCHIVED",
    OR: [
      { generations: { some: { createdById: ownerId } } },
      { links: { some: { ownerId } } },
    ],
    ...(templateId ? { id: templateId } : {}),
  };
}

export function archivedOpportunityCount(archivedAnnouncementCount: number, archivedJourneyCount: number) {
  return archivedAnnouncementCount + archivedJourneyCount;
}
