import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DirectoryAccessService } from "../lib/directory/directory-access-service.ts";
import {
  PrismaDirectoryRepository,
  type DirectoryAttributeRecord,
  type DirectoryRepository,
  type ManagedDirectoryProfileRecord,
  type PublishedDirectoryProfileRecord,
} from "../lib/directory/directory-repository.ts";

const now = new Date("2026-09-10T12:00:00.000Z");

function attribute(overrides: Partial<DirectoryAttributeRecord> = {}): DirectoryAttributeRecord {
  return {
    id: "attribute-public",
    kind: "SKILL",
    displayValue: "Cybersécurité",
    code: "CYBERSECURITY",
    locale: "fr",
    locationGranularity: null,
    publicationStatus: "PUBLISHED",
    declaredTrustLevel: "DECLARED",
    verificationLossPolicy: "KEEP_AS_DECLARED",
    verification: null,
    ...overrides,
  };
}

function publishedProfile(attributes: DirectoryAttributeRecord[]): PublishedDirectoryProfileRecord {
  return {
    publicId: "2e886580-5de4-4f9f-b511-a27f51cdd821",
    actorType: "PERSON",
    status: "PUBLISHED",
    publicName: "Camille D.",
    publishedAt: now,
    attributes,
  };
}

function managedProfile(overrides: Partial<ManagedDirectoryProfileRecord> = {}): ManagedDirectoryProfileRecord {
  return {
    publicId: "2e886580-5de4-4f9f-b511-a27f51cdd821",
    actorType: "PERSON",
    status: "DRAFT",
    publicName: "Camille D.",
    consentedAt: null,
    publishedAt: null,
    disabledAt: null,
    subjectIdentity: { type: "PERSON", user: { id: "user-a" } },
    attributes: [attribute()],
    ...overrides,
  };
}

function repository(input: {
  published?: PublishedDirectoryProfileRecord | null;
  managed?: ManagedDirectoryProfileRecord[];
}): DirectoryRepository {
  return {
    async findPublishedByPublicId() { return input.published ?? null; },
    async listManagedByUserId() { return input.managed ?? []; },
  };
}

test("published DTO exposes only the explicit public whitelist", async () => {
  const service = new DirectoryAccessService(repository({ published: publishedProfile([attribute()]) }), () => now);
  const dto = await service.getPublishedProfile("2e886580-5de4-4f9f-b511-a27f51cdd821");
  assert.deepEqual(dto, {
    publicId: "2e886580-5de4-4f9f-b511-a27f51cdd821",
    actorType: "PERSON",
    publicName: "Camille D.",
    publishedAt: now.toISOString(),
    attributes: [{
      kind: "SKILL",
      displayValue: "Cybersécurité",
      code: "CYBERSECURITY",
      locale: "fr",
      locationGranularity: null,
      trustLevel: "DECLARED",
    }],
  });
  const serialized = JSON.stringify(dto);
  for (const forbidden of ["userId", "subjectIdentityId", "credentialId", "claimId", "email", "claimValue", "proof"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  }
});

test("draft and withdrawn attributes never cross the public boundary", async () => {
  const service = new DirectoryAccessService(repository({
    published: publishedProfile([
      attribute({ publicationStatus: "DRAFT", displayValue: "Privé" }),
      attribute({ publicationStatus: "WITHDRAWN", displayValue: "Retiré" }),
      attribute({ publicationStatus: "PUBLISHED", displayValue: "Public" }),
    ]),
  }), () => now);
  assert.deepEqual((await service.getPublishedProfile("public"))?.attributes.map((item) => item.displayValue), ["Public"]);
});

test("verification loss follows the subject policy without exposing provenance", async () => {
  const invalidVerification = {
    state: "REVOKED" as const,
    validUntil: null,
    credential: { status: "REVOKED" as const, expiresAt: null },
  };
  const service = new DirectoryAccessService(repository({
    published: publishedProfile([
      attribute({ declaredTrustLevel: "VERIFIED", verification: invalidVerification, verificationLossPolicy: "KEEP_AS_DECLARED", displayValue: "Conserver" }),
      attribute({ declaredTrustLevel: "VERIFIED", verification: invalidVerification, verificationLossPolicy: "WITHDRAW", displayValue: "Retirer" }),
    ]),
  }), () => now);
  const dto = await service.getPublishedProfile("public");
  assert.deepEqual(dto?.attributes, [{
    kind: "SKILL",
    displayValue: "Conserver",
    code: "CYBERSECURITY",
    locale: "fr",
    locationGranularity: null,
    trustLevel: "DECLARED",
  }]);
});

test("missing, draft and disabled profiles are the same logical 404", async () => {
  for (const result of [
    null,
    { ...publishedProfile([]), status: "DRAFT" as const },
    { ...publishedProfile([]), status: "DISABLED" as const },
  ]) {
    const service = new DirectoryAccessService(repository({ published: result }), () => now);
    assert.equal(await service.getPublishedProfile("unknown"), null);
  }
});

test("user A only receives profiles selected through their active manager relation", async () => {
  let requestedUserId = "";
  const repo: DirectoryRepository = {
    async findPublishedByPublicId() { return null; },
    async listManagedByUserId(userId) {
      requestedUserId = userId;
      return userId === "user-a" ? [managedProfile()] : [];
    },
  };
  const service = new DirectoryAccessService(repo, () => now);
  assert.equal((await service.listMyProfiles("user-a")).length, 1);
  assert.equal(requestedUserId, "user-a");
  assert.deepEqual(await service.listMyProfiles("user-b"), []);
});

test("organization management does not establish publication authority", async () => {
  const service = new DirectoryAccessService(repository({ managed: [managedProfile({
    actorType: "ORGANIZATION",
    subjectIdentity: { type: "ORGANIZATION", user: null },
  })] }), () => now);
  const [dto] = await service.listMyProfiles("user-a");
  assert.equal(dto?.canPublish, false);
  assert.equal(dto?.publicationAuthority, "NOT_ESTABLISHED");
});

test("Prisma queries enforce publication and manager boundaries with whitelist selects", async () => {
  const calls: Array<{ method: string; args: unknown }> = [];
  const client = { directoryProfile: {
    async findFirst(args: unknown) { calls.push({ method: "findFirst", args }); return null; },
    async findMany(args: unknown) { calls.push({ method: "findMany", args }); return []; },
  } };
  const repo = new PrismaDirectoryRepository(client as never);
  await repo.findPublishedByPublicId("public-id");
  await repo.listManagedByUserId("user-a");
  const serialized = JSON.stringify(calls);
  assert.match(serialized, /"publicId":"public-id","status":"PUBLISHED"/);
  assert.match(serialized, /"publicationStatus":"PUBLISHED"/);
  assert.match(serialized, /"managers":\{"some":\{"userId":"user-a","revokedAt":null\}\}/);
  for (const ownerScoped of ["portfolio", "workspace", "gLink", "relationCase", "matchingRun", "ownerId", "email", "claimValue"]) {
    assert.doesNotMatch(serialized, new RegExp(ownerScoped, "i"));
  }
});

test("directory source files contain no raw proof DTO fields or owner-scoped joins", () => {
  const files = [
    "lib/directory/contracts.ts",
    "lib/directory/directory-repository.ts",
    "lib/directory/directory-access-service.ts",
  ].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(files, /claimValue|issuerTrustedOrganization|documents|messages|workspaces|portfolios|relationCases/);
});
