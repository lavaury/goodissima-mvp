import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DirectoryAccessService } from "../lib/directory/directory-access-service.ts";
import {
  DirectoryEnrollmentError,
  DirectoryEnrollmentService,
} from "../lib/directory/directory-enrollment-service.ts";
import type {
  DirectoryAttributeWrite,
  DirectoryEnrollmentRepository,
  DirectoryManagedProfileRecord,
  DirectoryOwnedAttributeRecord,
  DirectorySubjectRecord,
} from "../lib/directory/directory-enrollment-repository.ts";
import type { DirectoryRepository } from "../lib/directory/directory-repository.ts";

const NOW = new Date("2026-09-10T14:00:00.000Z");

type StoredProfile = DirectoryManagedProfileRecord & {
  identityId: string;
  managerUserId: string;
  managerRevoked: boolean;
  publishedAt: Date | null;
  disabledAt: Date | null;
  normalizedName: string;
};
type Audit = Parameters<DirectoryEnrollmentRepository["createAudit"]>[0];

class MemoryEnrollmentRepository implements DirectoryEnrollmentRepository {
  subjects = new Map<string, DirectorySubjectRecord>();
  profiles = new Map<string, StoredProfile>();
  attributes = new Map<string, DirectoryOwnedAttributeRecord>();
  audits: Audit[] = [];
  transactions = 0;
  nextAttribute = 1;

  async transaction<T>(operation: (repository: DirectoryEnrollmentRepository) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return operation(this);
  }

  async findSubjectForUser(userId: string) { return this.subjects.get(userId) ?? null; }

  async findManagedProfile(userId: string, publicId: string) {
    const profile = this.profiles.get(publicId);
    return profile?.managerUserId === userId && !profile.managerRevoked ? profile : null;
  }

  async findOwnedAttribute(profileId: string, attributeId: string) {
    const attribute = this.attributes.get(attributeId);
    return attribute?.profileId === profileId ? attribute : null;
  }

  async countPublishedAttributes(profileId: string) {
    return [...this.attributes.values()].filter((item) => item.profileId === profileId && item.publicationStatus === "PUBLISHED").length;
  }

  async createDraft(input: { identityId: string; userId: string; publicName: string; normalizedName: string }) {
    if ([...this.profiles.values()].some((profile) => profile.identityId === input.identityId)) {
      throw { code: "P2002", meta: { target: ["subjectIdentityId"] } };
    }
    const publicId = `public-${this.profiles.size + 1}`;
    this.profiles.set(publicId, {
      id: `profile-${this.profiles.size + 1}`,
      publicId,
      identityId: input.identityId,
      managerUserId: input.userId,
      managerRevoked: false,
      actorType: "PERSON",
      status: "DRAFT",
      publicName: input.publicName,
      normalizedName: input.normalizedName,
      consentedAt: null,
      publishedAt: null,
      disabledAt: null,
      managerRole: "OWNER",
      subjectIdentityType: "PERSON",
      subjectUserId: input.userId,
    });
    this.audits.push({ profileId: `profile-${this.profiles.size}`, actorUserId: input.userId, action: "PROFILE_CREATED", occurredAt: NOW });
    return { publicId };
  }

  async updateProfileName(profileId: string, publicName: string, normalizedName: string) {
    const profile = [...this.profiles.values()].find((item) => item.id === profileId)!;
    profile.publicName = publicName;
    profile.normalizedName = normalizedName;
  }

  async createAttribute(profileId: string, input: DirectoryAttributeWrite) {
    const id = `attribute-${this.nextAttribute++}`;
    this.attributes.set(id, {
      id,
      profileId,
      ...input,
      publicationStatus: "DRAFT",
      declaredTrustLevel: "DECLARED",
      hasVerification: false,
    });
    return { id };
  }

  async updateAttribute(attributeId: string, input: Omit<DirectoryAttributeWrite, "kind">) {
    Object.assign(this.attributes.get(attributeId)!, input);
  }

  async updateAttributePublication(input: { attributeId: string; status: "PUBLISHED" | "WITHDRAWN"; at: Date }) {
    this.attributes.get(input.attributeId)!.publicationStatus = input.status;
  }

  async updateProfilePublication(input: { profileId: string; status: "PUBLISHED" | "DISABLED"; at: Date; initialConsent: boolean }) {
    const profile = [...this.profiles.values()].find((item) => item.id === input.profileId)!;
    profile.status = input.status;
    if (input.status === "DISABLED") profile.disabledAt = input.at;
    else {
      profile.publishedAt = input.at;
      profile.disabledAt = null;
      if (input.initialConsent) profile.consentedAt = input.at;
    }
  }

  async createAudit(input: Audit) { this.audits.push(input); }
}

function setup() {
  const repository = new MemoryEnrollmentRepository();
  repository.subjects.set("user-a", { identityId: "identity-a", identityType: "PERSON" });
  repository.subjects.set("user-b", { identityId: "identity-b", identityType: "PERSON" });
  repository.subjects.set("org-user", { identityId: "identity-org", identityType: "ORGANIZATION" });
  return { repository, service: new DirectoryEnrollmentService(repository, () => NOW) };
}

async function expectCode(operation: Promise<unknown>, code: string) {
  await assert.rejects(operation, (error: unknown) => error instanceof DirectoryEnrollmentError && error.code === code);
}

function accessRepository(repository: MemoryEnrollmentRepository): DirectoryRepository {
  return {
    async findPublishedByPublicId(publicId) {
      const profile = repository.profiles.get(publicId);
      if (!profile || profile.status !== "PUBLISHED") return null;
      return {
        publicId,
        actorType: profile.actorType,
        status: profile.status,
        publicName: profile.publicName,
        publishedAt: profile.publishedAt,
        attributes: [...repository.attributes.values()]
          .filter((item) => item.profileId === profile.id && item.publicationStatus === "PUBLISHED")
          .map((item) => ({
            id: item.id,
            kind: item.kind,
            displayValue: item.displayValue,
            code: item.code,
            locale: item.locale,
            locationGranularity: item.locationGranularity,
            publicationStatus: item.publicationStatus,
            declaredTrustLevel: item.declaredTrustLevel,
            verificationLossPolicy: item.verificationLossPolicy,
            verification: null,
          })),
      };
    },
    async listManagedByUserId() { return []; },
  };
}

test("linked PERSON creates one private draft, OWNER manager and minimal audit", async () => {
  const { repository, service } = setup();
  const result = await service.createMyDirectoryDraft("user-a", { publicName: "  Camille   Durand  " });
  assert.deepEqual(result, { publicId: "public-1", status: "DRAFT" });
  const profile = repository.profiles.get("public-1")!;
  assert.equal(profile.actorType, "PERSON");
  assert.equal(profile.status, "DRAFT");
  assert.equal(profile.publicName, "Camille Durand");
  assert.equal(profile.normalizedName, "camille durand");
  assert.equal(profile.managerRole, "OWNER");
  assert.equal(profile.consentedAt, null);
  assert.equal(profile.publishedAt, null);
  assert.deepEqual(repository.audits.map((event) => event.action), ["PROFILE_CREATED"]);
  assert.equal(JSON.stringify(repository.profiles).includes("email"), false);
  assert.equal(repository.transactions, 1);
});

test("second profile for one identity is mapped to a domain conflict", async () => {
  const { service } = setup();
  await service.createMyDirectoryDraft("user-a", { publicName: "Camille" });
  await expectCode(service.createMyDirectoryDraft("user-a", { publicName: "Autre nom" }), "DIRECTORY_PROFILE_ALREADY_EXISTS");
});

test("organization identity and self-declared email public names are refused", async () => {
  const { service } = setup();
  await expectCode(service.createMyDirectoryDraft("org-user", { publicName: "Organisation" }), "DIRECTORY_PERSON_IDENTITY_REQUIRED");
  await expectCode(service.createMyDirectoryDraft("user-a", { publicName: "private@example.test" }), "DIRECTORY_INVALID_PUBLIC_NAME");
});

test("declared attributes are normalized drafts and cannot accept verification fields", async () => {
  const { repository, service } = setup();
  const { publicId } = await service.createMyDirectoryDraft("user-a", { publicName: "Camille" });
  const created = await service.addMyDeclaredAttribute("user-a", publicId, {
    kind: "SKILL",
    displayValue: "  Sécurité   Réseau ",
    verificationLossPolicy: "WITHDRAW",
  });
  const stored = repository.attributes.get(created.attributeId)!;
  assert.equal(stored.normalizedValue, "sécurité réseau");
  assert.equal(stored.publicationStatus, "DRAFT");
  assert.equal(stored.declaredTrustLevel, "DECLARED");
  assert.equal(stored.hasVerification, false);
  await expectCode(service.addMyDeclaredAttribute("user-a", publicId, {
    kind: "SKILL",
    displayValue: "Injection",
    declaredTrustLevel: "VERIFIED",
    credentialId: "credential-private",
  } as never), "DIRECTORY_INVALID_ATTRIBUTE");
  await expectCode(service.addMyDeclaredAttribute("user-a", publicId, {
    kind: "ORGANIZATION_DOMAIN",
    displayValue: "Conseil",
  }), "DIRECTORY_INVALID_ATTRIBUTE");
});

test("attribute update, publication and withdrawal are scoped and audited", async () => {
  const { repository, service } = setup();
  const a = await service.createMyDirectoryDraft("user-a", { publicName: "A".repeat(2) });
  const b = await service.createMyDirectoryDraft("user-b", { publicName: "B".repeat(2) });
  const attribute = await service.addMyDeclaredAttribute("user-a", a.publicId, { kind: "LANGUAGE", displayValue: "Allemand", locale: "de" });
  await service.updateMyDeclaredAttribute("user-a", a.publicId, attribute.attributeId, { displayValue: "Allemand courant" });
  await service.publishMyDirectoryAttribute("user-a", a.publicId, attribute.attributeId);
  assert.equal(repository.attributes.get(attribute.attributeId)?.publicationStatus, "PUBLISHED");
  await expectCode(service.withdrawMyDirectoryAttribute("user-b", b.publicId, attribute.attributeId), "DIRECTORY_ATTRIBUTE_NOT_FOUND");
  await service.withdrawMyDirectoryAttribute("user-a", a.publicId, attribute.attributeId);
  assert.equal(repository.attributes.get(attribute.attributeId)?.publicationStatus, "WITHDRAWN");
  assert.deepEqual(repository.audits.slice(-3).map((event) => event.action), ["ATTRIBUTE_UPDATED", "ATTRIBUTE_PUBLISHED", "ATTRIBUTE_WITHDRAWN"]);
});

test("profile publication requires one published attribute and becomes publicly readable", async () => {
  const { repository, service } = setup();
  const draft = await service.createMyDirectoryDraft("user-a", { publicName: "Camille" });
  await expectCode(service.publishMyDirectoryProfile("user-a", draft.publicId), "DIRECTORY_PUBLISHED_ATTRIBUTE_REQUIRED");
  const attribute = await service.addMyDeclaredAttribute("user-a", draft.publicId, { kind: "PROFESSION", displayValue: "Experte cybersécurité" });
  await service.publishMyDirectoryAttribute("user-a", draft.publicId, attribute.attributeId);
  await service.publishMyDirectoryProfile("user-a", draft.publicId);
  const access = new DirectoryAccessService(accessRepository(repository), () => NOW);
  const dto = await access.getPublishedProfile(draft.publicId);
  assert.equal(dto?.publicName, "Camille");
  assert.equal(dto?.attributes.length, 1);
  assert.equal(repository.profiles.get(draft.publicId)?.consentedAt, NOW);
  assert.equal(repository.audits.at(-1)?.action, "PROFILE_PUBLISHED");
});

test("disable hides the profile and republish preserves initial consent", async () => {
  const { repository, service } = setup();
  const draft = await service.createMyDirectoryDraft("user-a", { publicName: "Camille" });
  const attribute = await service.addMyDeclaredAttribute("user-a", draft.publicId, { kind: "SKILL", displayValue: "Cybersécurité" });
  await service.publishMyDirectoryAttribute("user-a", draft.publicId, attribute.attributeId);
  await service.publishMyDirectoryProfile("user-a", draft.publicId);
  const initialConsent = repository.profiles.get(draft.publicId)?.consentedAt;
  await service.disableMyDirectoryProfile("user-a", draft.publicId);
  const access = new DirectoryAccessService(accessRepository(repository), () => NOW);
  assert.equal(await access.getPublishedProfile(draft.publicId), null);
  assert.equal(repository.attributes.get(attribute.attributeId)?.publicationStatus, "PUBLISHED");
  await service.republishMyDirectoryProfile("user-a", draft.publicId);
  assert.ok(await access.getPublishedProfile(draft.publicId));
  assert.equal(repository.profiles.get(draft.publicId)?.consentedAt, initialConsent);
  assert.deepEqual(repository.audits.slice(-2).map((event) => event.action), ["PROFILE_DISABLED", "PROFILE_REPUBLISHED"]);
});

test("foreign, revoked and organization managers cannot mutate or publish", async () => {
  const { repository, service } = setup();
  const draft = await service.createMyDirectoryDraft("user-a", { publicName: "Camille" });
  await expectCode(service.updateMyDirectoryPublicName("user-b", draft.publicId, "Intrusion"), "DIRECTORY_PROFILE_NOT_FOUND");
  repository.profiles.get(draft.publicId)!.managerRevoked = true;
  await expectCode(service.updateMyDirectoryPublicName("user-a", draft.publicId, "Intrusion"), "DIRECTORY_PROFILE_NOT_FOUND");
  repository.profiles.get(draft.publicId)!.managerRevoked = false;
  repository.profiles.get(draft.publicId)!.subjectUserId = "revoked";
  await expectCode(service.updateMyDirectoryPublicName("user-a", draft.publicId, "Intrusion"), "DIRECTORY_PERSON_AUTHORITY_REQUIRED");
  repository.profiles.get(draft.publicId)!.subjectUserId = "user-a";
  repository.profiles.get(draft.publicId)!.actorType = "ORGANIZATION";
  repository.profiles.get(draft.publicId)!.subjectIdentityType = "ORGANIZATION";
  await expectCode(service.publishMyDirectoryProfile("user-a", draft.publicId), "DIRECTORY_PERSON_AUTHORITY_REQUIRED");
});

test("audits contain identifiers and actions only, never personal values or proof", async () => {
  const { repository, service } = setup();
  const draft = await service.createMyDirectoryDraft("user-a", { publicName: "Nom très privé" });
  await service.addMyDeclaredAttribute("user-a", draft.publicId, { kind: "QUALIFICATION", displayValue: "Diplôme privé" });
  const serialized = JSON.stringify(repository.audits);
  for (const forbidden of ["Nom très privé", "Diplôme privé", "email", "credentialId", "claimId", "proof", "displayValue"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  }
});

test("server commands derive the user from auth and never accept a client user id", () => {
  const commands = readFileSync(new URL("../lib/directory/directory-enrollment-commands.ts", import.meta.url), "utf8");
  assert.match(commands, /await getCurrentPrismaUser\(\)/);
  assert.doesNotMatch(commands, /export async function \w+\(userId/);
  assert.doesNotMatch(commands, /ownerId|workspace|portfolio|relationCase|matching/i);
});
