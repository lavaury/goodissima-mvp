import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isDirectoryAttributeEffectivelyVerified,
  isDirectoryAttributePubliclyVisible,
} from "../lib/directory/directory-access-service.ts";
import type { DirectoryAttributeRecord } from "../lib/directory/directory-repository.ts";
import { PrismaDirectorySearchRepository, type DirectorySearchRepository, type NormalizedDirectorySearchCriteria } from "../lib/directory/directory-search-repository.ts";
import { DirectorySearchCriteriaError, DirectorySearchService, normalizeDirectorySearchCriteria } from "../lib/directory/directory-search-service.ts";

const NOW = new Date("2026-09-10T16:00:00.000Z");

function attribute(profileId: string, kind: DirectoryAttributeRecord["kind"], displayValue: string, overrides: Partial<DirectoryAttributeRecord> = {}) {
  return {
    id: `${profileId}-${kind}-${displayValue}`,
    profileId,
    kind,
    displayValue,
    normalizedValue: displayValue.toLocaleLowerCase("fr-FR"),
    code: null,
    locale: null,
    locationGranularity: null,
    publicationStatus: "PUBLISHED" as const,
    declaredTrustLevel: "DECLARED" as const,
    verificationLossPolicy: "KEEP_AS_DECLARED" as const,
    verification: null,
    ...overrides,
  };
}

type FixtureProfile = {
  internalId: string;
  publicId: string;
  actorType: "PERSON" | "ORGANIZATION";
  status: "DRAFT" | "PUBLISHED" | "DISABLED";
  publicName: string;
  normalizedName: string;
  attributes: ReturnType<typeof attribute>[];
};

class MemorySearchRepository implements DirectorySearchRepository {
  private readonly fixtures: FixtureProfile[];

  constructor(fixtures: FixtureProfile[]) {
    this.fixtures = fixtures;
  }

  async searchPublished(criteria: NormalizedDirectorySearchCriteria, now: Date) {
    const matchesNormal = (profile: FixtureProfile, kind: string, values: string[]) => profile.attributes.some((item) =>
      item.kind === kind && values.includes(item.normalizedValue) && isDirectoryAttributePubliclyVisible(item, now));
    const filtered = this.fixtures.filter((profile) => {
      if (profile.status !== "PUBLISHED") return false;
      if (criteria.actorType && profile.actorType !== criteria.actorType) return false;
      if (criteria.text && !profile.normalizedName.includes(criteria.text)
        && !profile.attributes.some((item) => item.normalizedValue.includes(criteria.text!) && isDirectoryAttributePubliclyVisible(item, now))) return false;
      if (criteria.filters.some((filter) => !matchesNormal(profile, filter.kind, filter.values))) return false;
      return criteria.verificationRequirements.every((kind) => profile.attributes.some((item) =>
        item.kind === kind && item.publicationStatus === "PUBLISHED" && isDirectoryAttributeEffectivelyVerified(item, now)));
    }).sort((left, right) => left.normalizedName.localeCompare(right.normalizedName) || left.publicId.localeCompare(right.publicId));
    const start = criteria.cursor ? Math.max(0, filtered.findIndex((item) => item.publicId === criteria.cursor) + 1) : 0;
    const window = filtered.slice(start, start + criteria.limit + 1);
    const selected = window.slice(0, criteria.limit);
    return {
      profiles: selected.map(({ internalId, publicId, actorType, publicName, normalizedName }) => ({ internalId, publicId, actorType, publicName, normalizedName })),
      attributes: selected.flatMap((profile) => profile.attributes),
      nextCursor: window.length > criteria.limit ? selected.at(-1)?.publicId ?? null : null,
    };
  }
}

const activeVerification = {
  state: "VALID" as const,
  validUntil: new Date("2027-01-01T00:00:00.000Z"),
  credential: { status: "ACTIVE" as const, expiresAt: new Date("2027-01-01T00:00:00.000Z") },
};

function completeProfile(overrides: Partial<FixtureProfile> = {}): FixtureProfile {
  const internalId = overrides.internalId ?? "profile-a";
  return {
    internalId,
    publicId: "public-a",
    actorType: "PERSON",
    status: "PUBLISHED",
    publicName: "Anna Cyber",
    normalizedName: "anna cyber",
    attributes: [
      attribute(internalId, "PROFESSION", "Experte cybersécurité"),
      attribute(internalId, "SKILL", "Cybersécurité"),
      attribute(internalId, "SKILL", "Sécurité réseau"),
      attribute(internalId, "LANGUAGE", "Allemand"),
      attribute(internalId, "LOCATION", "Berlin", { locationGranularity: "CITY" }),
      attribute(internalId, "QUALIFICATION", "Master informatique"),
      attribute(internalId, "CERTIFICATION", "CISSP", { declaredTrustLevel: "VERIFIED", verification: activeVerification }),
    ],
    ...overrides,
  };
}

async function search(fixtures: FixtureProfile[], criteria: unknown) {
  return new DirectorySearchService(new MemorySearchRepository(fixtures), () => NOW).search(criteria);
}

test("criteria contract is closed, normalized and bounded", () => {
  assert.deepEqual(normalizeDirectorySearchCriteria({
    actorType: "PERSON",
    text: "  Expert   Cyber ",
    skills: [" Cybersécurité ", "cybersécurité"],
    verificationRequirements: [{ kind: "CERTIFICATION", level: "VERIFIED" }],
    limit: 500,
  }), {
    actorType: "PERSON",
    text: "expert cyber",
    filters: [{ kind: "SKILL", values: ["cybersécurité"] }],
    verificationRequirements: ["CERTIFICATION"],
    cursor: undefined,
    limit: 50,
  });
  for (const invalid of [
    { sql: "SELECT *" },
    { skills: { contains: "x" } },
    { verificationRequirements: [{ kind: "CERTIFICATION", level: "DECLARED" }] },
    { actorType: "USER" },
    { limit: 0 },
  ]) assert.throws(() => normalizeDirectorySearchCriteria(invalid), DirectorySearchCriteriaError);
});

test("draft and disabled profiles and non-published attributes are absent", async () => {
  const published = completeProfile({ attributes: [
    attribute("profile-a", "SKILL", "Visible"),
    attribute("profile-a", "SKILL", "Brouillon", { publicationStatus: "DRAFT" }),
    attribute("profile-a", "LANGUAGE", "Retirée", { publicationStatus: "WITHDRAWN" }),
  ] });
  const page = await search([
    published,
    completeProfile({ internalId: "draft", publicId: "public-draft", status: "DRAFT" }),
    completeProfile({ internalId: "disabled", publicId: "public-disabled", status: "DISABLED" }),
  ], {});
  assert.deepEqual(page.items.map((item) => item.publicId), ["public-a"]);
  assert.deepEqual(page.items[0]?.attributes.map((item) => item.displayValue), ["Visible"]);
});

test("all six V1 attribute filters are deterministic", async () => {
  const fixture = completeProfile();
  const cases = [
    ["professions", "Experte cybersécurité"],
    ["skills", "Cybersécurité"],
    ["languages", "Allemand"],
    ["locations", "Berlin"],
    ["qualifications", "Master informatique"],
    ["certifications", "CISSP"],
  ] as const;
  for (const [field, value] of cases) {
    assert.equal((await search([fixture], { [field]: [value] })).items.length, 1, field);
    assert.equal((await search([fixture], { [field]: ["absent"] })).items.length, 0, field);
  }
});

test("values are OR within a category and categories are ANDed", async () => {
  const fixture = completeProfile();
  assert.equal((await search([fixture], { skills: ["absente", "sécurité réseau"], languages: ["allemand"] })).items.length, 1);
  assert.equal((await search([fixture], { skills: ["cybersécurité"], languages: ["anglais"] })).items.length, 0);
});

test("text searches only published directory names and attribute values", async () => {
  const fixture = completeProfile();
  assert.match((await search([fixture], { text: "Anna" })).items[0]?.matchReasons[0] ?? "", /^Nom correspondant/);
  assert.match((await search([fixture], { text: "réseau" })).items[0]?.matchReasons[0] ?? "", /^Texte correspondant/);
});

test("verified requirements use effective provenance, never the declared flag alone", async () => {
  const invalidCases = [
    attribute("declared", "CERTIFICATION", "Déclarée"),
    attribute("expired", "CERTIFICATION", "Expirée", { declaredTrustLevel: "VERIFIED", verification: { ...activeVerification, validUntil: new Date("2026-01-01") } }),
    attribute("revoked", "CERTIFICATION", "Révoquée", { declaredTrustLevel: "VERIFIED", verification: { ...activeVerification, credential: { status: "REVOKED", expiresAt: null } } }),
    attribute("suspended", "CERTIFICATION", "Suspendue", { declaredTrustLevel: "VERIFIED", verification: { ...activeVerification, credential: { status: "SUSPENDED", expiresAt: null } } }),
  ];
  const fixtures = [completeProfile(), ...invalidCases.map((item, index) => completeProfile({
    internalId: item.profileId,
    publicId: `invalid-${index}`,
    publicName: `Invalid ${index}`,
    normalizedName: `invalid ${index}`,
    attributes: [item],
  }))];
  const page = await search(fixtures, { verificationRequirements: [{ kind: "CERTIFICATION", level: "VERIFIED" }] });
  assert.deepEqual(page.items.map((item) => item.publicId), ["public-a"]);
  assert.match(page.items[0]?.matchReasons.at(-1) ?? "", /Certification vérifiée : CISSP/);
});

test("verification loss respects KEEP_AS_DECLARED and WITHDRAW", async () => {
  const lost = { state: "REVOKED" as const, validUntil: null, credential: { status: "REVOKED" as const, expiresAt: null } };
  const keep = completeProfile({ internalId: "keep", publicId: "keep", publicName: "Keep", normalizedName: "keep", attributes: [
    attribute("keep", "CERTIFICATION", "Ancienne", { declaredTrustLevel: "VERIFIED", verification: lost, verificationLossPolicy: "KEEP_AS_DECLARED" }),
  ] });
  const withdraw = completeProfile({ internalId: "withdraw", publicId: "withdraw", publicName: "Withdraw", normalizedName: "withdraw", attributes: [
    attribute("withdraw", "CERTIFICATION", "Ancienne", { declaredTrustLevel: "VERIFIED", verification: lost, verificationLossPolicy: "WITHDRAW" }),
  ] });
  assert.deepEqual((await search([keep, withdraw], { certifications: ["ancienne"] })).items.map((item) => item.publicId), ["keep"]);
  assert.equal((await search([keep, withdraw], { verificationRequirements: [{ kind: "CERTIFICATION", level: "VERIFIED" }] })).items.length, 0);
});

test("actor type supports published person and organization projections", async () => {
  const organization = completeProfile({ internalId: "org", publicId: "org", actorType: "ORGANIZATION", publicName: "Org", normalizedName: "org" });
  assert.deepEqual((await search([completeProfile(), organization], { actorType: "ORGANIZATION" })).items.map((item) => item.publicId), ["org"]);
});

test("pagination is bounded, stable and has no duplicates", async () => {
  const fixtures = ["A", "B", "C"].map((name) => completeProfile({ internalId: name, publicId: `public-${name}`, publicName: name, normalizedName: name.toLowerCase() }));
  const first = await search(fixtures, { limit: 2 });
  const second = await search(fixtures, { limit: 2, cursor: first.nextCursor });
  assert.equal(first.items.length, 2);
  assert.equal(second.items.length, 1);
  assert.equal(first.nextCursor, "public-B");
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.publicId)).size, 3);
});

test("result DTO is a strict whitelist without private or owner-scoped data", async () => {
  const serialized = JSON.stringify(await search([completeProfile()], {}));
  for (const forbidden of ["internalId", "profileId", "User.id", "subjectIdentityId", "userId", "credentialId", "claimId", "email", "proof", "audit", "ownerId", "workspace", "portfolio", "relationCase"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  }
});

test("Prisma repository uses two grouped queries and publication-only predicates", async () => {
  const calls: Array<{ model: string; args: any }> = [];
  const client = {
    directoryProfile: { async findMany(args: any) {
      calls.push({ model: "profile", args });
      return [{ id: "internal", publicId: "public", actorType: "PERSON", publicName: "Nom", normalizedName: "nom" }];
    } },
    directoryAttribute: { async findMany(args: any) { calls.push({ model: "attribute", args }); return []; } },
  };
  const repository = new PrismaDirectorySearchRepository(client as never);
  await repository.searchPublished(normalizeDirectorySearchCriteria({ skills: ["cyber"], languages: ["de"] }), NOW);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.model, "profile");
  assert.equal(calls[1]?.model, "attribute");
  const serialized = JSON.stringify(calls);
  assert.match(serialized, /"status":"PUBLISHED"/);
  assert.match(serialized, /"publicationStatus":"PUBLISHED"/);
  assert.match(serialized, /"profileId":\{"in":\["internal"\]\}/);
  assert.doesNotMatch(serialized, /ownerId|workspace|portfolio|relationCase|matching|email|claimValue/i);
});

test("authenticated route remains separate from Goodissima search, matching and AI", () => {
  const route = readFileSync(new URL("../app/api/directory/search/route.ts", import.meta.url), "utf8");
  const repository = readFileSync(new URL("../lib/directory/directory-search-repository.ts", import.meta.url), "utf8");
  assert.match(route, /await getCurrentPrismaUser\(\)/);
  assert.doesNotMatch(`${route}\n${repository}`, /goodissima-search|matchingEnabled|MatchingRun|MatchingResult|RelationCase|embedding|\bAI\b/);
});
