import type {
  DirectoryActorTypeDto,
  DirectoryAttributeKindDto,
  PublishedDirectoryAttributeDto,
} from "./contracts.ts";

export const DIRECTORY_SEARCH_FILTER_KINDS = [
  "PROFESSION",
  "SKILL",
  "LANGUAGE",
  "LOCATION",
  "QUALIFICATION",
  "CERTIFICATION",
] as const satisfies readonly DirectoryAttributeKindDto[];
export type DirectorySearchFilterKind = (typeof DIRECTORY_SEARCH_FILTER_KINDS)[number];

export type DirectoryVerificationRequirement = {
  kind: DirectorySearchFilterKind;
  level: "VERIFIED";
};

/** Closed V1 contract. Values are OR within one array and categories are ANDed. */
export type DirectorySearchCriteria = {
  actorType?: DirectoryActorTypeDto;
  text?: string;
  professions?: string[];
  skills?: string[];
  languages?: string[];
  locations?: string[];
  qualifications?: string[];
  certifications?: string[];
  verificationRequirements?: DirectoryVerificationRequirement[];
  cursor?: string;
  limit?: number;
};

export type DirectorySearchResultDto = {
  publicId: string;
  actorType: DirectoryActorTypeDto;
  publicName: string;
  attributes: PublishedDirectoryAttributeDto[];
  matchReasons: string[];
};

export type DirectorySearchPageDto = {
  items: DirectorySearchResultDto[];
  nextCursor: string | null;
};
