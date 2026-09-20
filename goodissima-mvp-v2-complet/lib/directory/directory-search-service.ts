import { DIRECTORY_ACTOR_TYPES } from "./contracts.ts";
import {
  isDirectoryAttributeEffectivelyVerified,
  isDirectoryAttributePubliclyVisible,
  toPublishedDirectoryAttributeDto,
} from "./directory-access-service.ts";
import { normalizeDirectoryValue } from "./directory-enrollment-service.ts";
import {
  DIRECTORY_SEARCH_FILTER_KINDS,
  type DirectorySearchCriteria,
  type DirectorySearchFilterKind,
  type DirectorySearchPageDto,
} from "./directory-search-contracts.ts";
import type {
  DirectorySearchAttributeRecord,
  DirectorySearchRepository,
  NormalizedDirectorySearchCriteria,
} from "./directory-search-repository.ts";

export const DIRECTORY_SEARCH_DEFAULT_LIMIT = 20;
export const DIRECTORY_SEARCH_MAX_LIMIT = 50;
const MAX_FILTER_VALUES = 10;
const FILTER_VALUE_MAX_LENGTH = 120;

const FILTERS: Array<{ field: keyof DirectorySearchCriteria; kind: DirectorySearchFilterKind; label: string }> = [
  { field: "professions", kind: "PROFESSION", label: "Métier correspondant" },
  { field: "skills", kind: "SKILL", label: "Compétence correspondante" },
  { field: "languages", kind: "LANGUAGE", label: "Langue correspondante" },
  { field: "locations", kind: "LOCATION", label: "Localisation correspondante" },
  { field: "qualifications", kind: "QUALIFICATION", label: "Qualification correspondante" },
  { field: "certifications", kind: "CERTIFICATION", label: "Certification correspondante" },
];

const ALLOWED_KEYS = new Set([
  "actorType", "text", "professions", "skills", "languages", "locations",
  "qualifications", "certifications", "verificationRequirements", "cursor", "limit",
]);

export class DirectorySearchCriteriaError extends Error {
  readonly code = "DIRECTORY_SEARCH_CRITERIA_INVALID";

  constructor() {
    super("DIRECTORY_SEARCH_CRITERIA_INVALID");
    this.name = "DirectorySearchCriteriaError";
  }
}

function invalid(): never {
  throw new DirectorySearchCriteriaError();
}

function normalizedValues(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_FILTER_VALUES) return invalid();
  const values = value.map((item) => {
    if (typeof item !== "string") return invalid();
    const cleaned = item.normalize("NFKC").trim().replace(/\s+/g, " ");
    if (!cleaned || cleaned.length > FILTER_VALUE_MAX_LENGTH) return invalid();
    return normalizeDirectoryValue(cleaned);
  });
  return [...new Set(values)];
}

export function normalizeDirectorySearchCriteria(input: unknown): NormalizedDirectorySearchCriteria {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid();
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !ALLOWED_KEYS.has(key))) return invalid();
  if (value.actorType !== undefined && !DIRECTORY_ACTOR_TYPES.includes(value.actorType as never)) return invalid();

  let text: string | undefined;
  if (value.text !== undefined) {
    if (typeof value.text !== "string") return invalid();
    const cleaned = value.text.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ");
    if (cleaned.length < 2 || cleaned.length > 80) return invalid();
    text = normalizeDirectoryValue(cleaned);
  }

  const filters = FILTERS.flatMap(({ field, kind }) => {
    const values = normalizedValues(value[field]);
    return values.length ? [{ kind, values }] : [];
  });
  const requirementsValue = value.verificationRequirements ?? [];
  if (!Array.isArray(requirementsValue) || requirementsValue.length > DIRECTORY_SEARCH_FILTER_KINDS.length) return invalid();
  const verificationRequirements = requirementsValue.map((requirement) => {
    if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) return invalid();
    const record = requirement as Record<string, unknown>;
    if (Object.keys(record).some((key) => key !== "kind" && key !== "level")) return invalid();
    if (!DIRECTORY_SEARCH_FILTER_KINDS.includes(record.kind as never) || record.level !== "VERIFIED") return invalid();
    return record.kind as DirectorySearchFilterKind;
  });
  const cursor = value.cursor === undefined ? undefined : typeof value.cursor === "string" && value.cursor.length >= 1 && value.cursor.length <= 100
    ? value.cursor
    : invalid();
  const limit = value.limit === undefined ? DIRECTORY_SEARCH_DEFAULT_LIMIT : value.limit;
  if (!Number.isInteger(limit) || Number(limit) < 1) return invalid();

  return {
    actorType: value.actorType as NormalizedDirectorySearchCriteria["actorType"],
    text,
    filters,
    verificationRequirements: [...new Set(verificationRequirements)],
    cursor,
    limit: Math.min(Number(limit), DIRECTORY_SEARCH_MAX_LIMIT),
  };
}

function matchingReasons(
  criteria: NormalizedDirectorySearchCriteria,
  profileName: string,
  normalizedName: string,
  attributes: DirectorySearchAttributeRecord[],
  now: Date,
): string[] {
  const reasons: string[] = [];
  if (criteria.text) {
    if (normalizedName.includes(criteria.text)) reasons.push(`Nom correspondant : ${profileName}`);
    else {
      const match = attributes.find((attribute) => attribute.normalizedValue.includes(criteria.text!));
      if (match) reasons.push(`Texte correspondant : ${match.displayValue}`);
    }
  }
  for (const filter of criteria.filters) {
    const definition = FILTERS.find((item) => item.kind === filter.kind)!;
    const matches = attributes.filter((attribute) => attribute.kind === filter.kind && filter.values.includes(attribute.normalizedValue));
    for (const match of matches) reasons.push(`${definition.label} : ${match.displayValue}`);
  }
  for (const kind of criteria.verificationRequirements) {
    const match = attributes.find((attribute) => attribute.kind === kind && isDirectoryAttributeEffectivelyVerified(attribute, now));
    if (match) reasons.push(`${FILTERS.find((item) => item.kind === kind)!.label.replace("correspondante", "vérifiée").replace("correspondant", "vérifié")} : ${match.displayValue}`);
  }
  return [...new Set(reasons)];
}

export class DirectorySearchService {
  private readonly repository: DirectorySearchRepository;
  private readonly now: () => Date;

  constructor(repository: DirectorySearchRepository, now: () => Date = () => new Date()) {
    this.repository = repository;
    this.now = now;
  }

  async search(input: unknown): Promise<DirectorySearchPageDto> {
    const criteria = normalizeDirectorySearchCriteria(input);
    const now = this.now();
    const records = await this.repository.searchPublished(criteria, now);
    const attributesByProfile = new Map<string, DirectorySearchAttributeRecord[]>();
    for (const attribute of records.attributes) {
      if (!isDirectoryAttributePubliclyVisible(attribute, now)) continue;
      const current = attributesByProfile.get(attribute.profileId) ?? [];
      current.push(attribute);
      attributesByProfile.set(attribute.profileId, current);
    }
    return {
      items: records.profiles.map((profile) => {
        const attributes = attributesByProfile.get(profile.internalId) ?? [];
        return {
          publicId: profile.publicId,
          actorType: profile.actorType,
          publicName: profile.publicName,
          attributes: attributes.map((attribute) => toPublishedDirectoryAttributeDto(attribute, now)),
          matchReasons: matchingReasons(criteria, profile.publicName, profile.normalizedName, attributes, now),
        };
      }),
      nextCursor: records.nextCursor,
    };
  }
}
