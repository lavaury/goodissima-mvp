import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = source("prisma/schema.prisma");
const migration = source("prisma/migrations/20260910120000_add_global_directory_foundation/migration.sql");

test("directory profiles are opt-in drafts for person and organization actors", () => {
  assert.match(schema, /enum DirectoryActorType \{\s+PERSON\s+ORGANIZATION\s+\}/);
  assert.match(schema, /model DirectoryProfile \{[\s\S]*actorType\s+DirectoryActorType/);
  assert.match(schema, /status\s+DirectoryProfileStatus\s+@default\(DRAFT\)/);
  assert.match(schema, /publicId\s+String\s+@unique @default\(uuid\(\)\)/);
  assert.match(schema, /subjectIdentityId\s+String\s+@unique/);
  assert.match(migration, /"actorType" "DirectoryActorType" NOT NULL/);
  assert.match(migration, /"status" "DirectoryProfileStatus" NOT NULL DEFAULT 'DRAFT'/);
  assert.match(migration, /CREATE TYPE "DirectoryActorType" AS ENUM \('PERSON', 'ORGANIZATION'\)/);
});

test("directory attributes default to private declared drafts with an explicit loss policy", () => {
  assert.match(schema, /model DirectoryAttribute \{[\s\S]*publicationStatus\s+DirectoryPublicationStatus\s+@default\(DRAFT\)/);
  assert.match(schema, /declaredTrustLevel\s+DirectoryTrustLevel\s+@default\(DECLARED\)/);
  assert.match(schema, /verificationLossPolicy\s+DirectoryVerificationLossPolicy\s+@default\(KEEP_AS_DECLARED\)/);
  assert.match(schema, /enum DirectoryPublicationStatus \{\s+DRAFT\s+PUBLISHED\s+WITHDRAWN\s+\}/);
  assert.match(schema, /enum DirectoryVerificationLossPolicy \{\s+KEEP_AS_DECLARED\s+WITHDRAW\s+\}/);
  assert.match(migration, /"publicationStatus" "DirectoryPublicationStatus" NOT NULL DEFAULT 'DRAFT'/);
  assert.match(migration, /"declaredTrustLevel" "DirectoryTrustLevel" NOT NULL DEFAULT 'DECLARED'/);
  assert.match(migration, /"verificationLossPolicy" "DirectoryVerificationLossPolicy" NOT NULL DEFAULT 'KEEP_AS_DECLARED'/);
});

test("verification provenance is internal, optional by claim, and constrained to one attribute", () => {
  assert.match(schema, /attributeId\s+String\s+@unique/);
  assert.match(schema, /claimId\s+String\?/);
  assert.match(schema, /credential\s+TrustCredential\s+@relation\([\s\S]*onDelete: Restrict\)/);
  assert.match(schema, /claim\s+TrustClaim\?\s+@relation\([\s\S]*onDelete: SetNull\)/);
  assert.match(migration, /DirectoryVerificationProvenance_attributeId_key/);
  assert.match(migration, /DirectoryVerificationProvenance_credentialId_fkey[\s\S]*ON DELETE RESTRICT/);
  assert.match(migration, /DirectoryVerificationProvenance_claimId_fkey[\s\S]*ON DELETE SET NULL/);
});

test("profile and attribute removal have the required cascades", () => {
  assert.match(migration, /DirectoryProfileManager_profileId_fkey[\s\S]*ON DELETE CASCADE/);
  assert.match(migration, /DirectoryAttribute_profileId_fkey[\s\S]*ON DELETE CASCADE/);
  assert.match(migration, /DirectoryVerificationProvenance_attributeId_fkey[\s\S]*ON DELETE CASCADE/);
  assert.match(migration, /DirectoryProfile_subjectIdentityId_fkey[\s\S]*ON DELETE RESTRICT/);
});

test("migration is data-empty, non-destructive, and creates no automatic directory profile", () => {
  assert.doesNotMatch(migration, /^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/im);
  assert.doesNotMatch(migration, /\bDROP\b|ALTER\s+(?:TABLE|TYPE|INDEX)[\s\S]*\bDROP\b|\bRENAME\b/i);
  assert.doesNotMatch(migration, /CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|TRIGGER)\b/i);
  assert.doesNotMatch(schema, /model DirectoryProfile \{[\s\S]*\bemail\b/i);
});

test("directory search foundations use explicit bounded indexes without pg_trgm", () => {
  for (const index of [
    "@@index([status, actorType, publishedAt, id])",
    "@@index([actorType, status, normalizedName])",
    "@@index([profileId, publicationStatus, kind])",
    "@@index([kind, normalizedValue, publicationStatus, profileId])",
    "@@index([kind, code, publicationStatus, profileId])",
    "@@index([state, validUntil, attributeId])",
    "@@index([credentialId, state])",
  ]) assert.ok(schema.includes(index), `missing schema index ${index}`);

  assert.doesNotMatch(migration, /pg_trgm|gin_trgm_ops|CREATE EXTENSION/i);
});
