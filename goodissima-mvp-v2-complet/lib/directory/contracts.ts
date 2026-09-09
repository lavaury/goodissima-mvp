export const DIRECTORY_ACTOR_TYPES = ["PERSON", "ORGANIZATION"] as const;
export type DirectoryActorTypeDto = (typeof DIRECTORY_ACTOR_TYPES)[number];

export const DIRECTORY_ATTRIBUTE_KINDS = [
  "PROFESSION",
  "SKILL",
  "LANGUAGE",
  "LOCATION",
  "QUALIFICATION",
  "CERTIFICATION",
  "ORGANIZATION_DOMAIN",
] as const;
export type DirectoryAttributeKindDto = (typeof DIRECTORY_ATTRIBUTE_KINDS)[number];

export type DirectoryTrustLevelDto = "DECLARED" | "VERIFIED";
export type DirectoryLocationGranularityDto = "COUNTRY" | "REGION" | "CITY";

/** Public whitelist. No internal subject, user, credential or claim identifier belongs here. */
export type PublishedDirectoryAttributeDto = {
  kind: DirectoryAttributeKindDto;
  displayValue: string;
  code: string | null;
  locale: string | null;
  locationGranularity: DirectoryLocationGranularityDto | null;
  trustLevel: DirectoryTrustLevelDto;
};

/** DTO returned by the directory reading surface. */
export type PublishedDirectoryProfileDto = {
  publicId: string;
  actorType: DirectoryActorTypeDto;
  publicName: string;
  publishedAt: string;
  attributes: PublishedDirectoryAttributeDto[];
};

export type ManagedDirectoryAttributeDto = PublishedDirectoryAttributeDto & {
  attributeId: string;
  publicationStatus: "DRAFT" | "PUBLISHED" | "WITHDRAWN";
  verificationLossPolicy: "KEEP_AS_DECLARED" | "WITHDRAW";
};

/** Private management DTO, still deliberately free of internal identifiers and raw proof data. */
export type ManagedDirectoryProfileDto = {
  publicId: string;
  actorType: DirectoryActorTypeDto;
  status: "DRAFT" | "PUBLISHED" | "DISABLED";
  publicName: string;
  consentedAt: string | null;
  publishedAt: string | null;
  disabledAt: string | null;
  canPublish: boolean;
  publicationAuthority: "PERSON_IDENTITY_OWNER" | "NOT_ESTABLISHED";
  attributes: ManagedDirectoryAttributeDto[];
};
