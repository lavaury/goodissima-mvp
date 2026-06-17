export const ANNOUNCEMENT_PUBLICATION_SUCCESS = "Annonce publiée avec succès.";

export type AnnouncementPublicationStatus = "DRAFT" | "PUBLISHED";

export type AnnouncementPublicationState = {
  status: AnnouncementPublicationStatus;
  publishedAt: string | null;
  publicationStatus: string;
};

export type AnnouncementPublicationResult = {
  publishedObject: "ANNOUNCEMENT";
  status: "PUBLISHED";
  publishedAt: string;
  version: number;
};

export function announcementPublicationState(input?: {
  isPublished?: boolean;
  publishedAt?: string | null;
}): AnnouncementPublicationState {
  if (input?.isPublished) {
    return {
      status: "PUBLISHED",
      publishedAt: input.publishedAt ?? null,
      publicationStatus: "Publiée",
    };
  }

  return {
    status: "DRAFT",
    publishedAt: null,
    publicationStatus: "Brouillon · Non publiée",
  };
}

export function applyAnnouncementPublication(
  result: AnnouncementPublicationResult,
): AnnouncementPublicationState {
  return announcementPublicationState({
    isPublished: result.status === "PUBLISHED",
    publishedAt: result.publishedAt,
  });
}
