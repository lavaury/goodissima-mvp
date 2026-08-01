import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DirectoryValidationError,
  canTransitionRepresentation,
  parseCreateRepresentationInput,
  parseUpdateRepresentationInput,
  parseSetRelationshipPolicyInput,
  parseSetRepresentationVisibilityInput,
  representationTransitionPatch,
  representationVisibilityPatch,
} from "../lib/directory/contracts.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("schema supports multiple private representations per linked identity", () => {
  const schema = source("prisma/schema.prisma");
  assert.match(schema, /model Representation \{[\s\S]*ownerId\s+String[\s\S]*identityId\s+String/);
  assert.match(schema, /representations\s+Representation\[\]/);
  assert.match(schema, /status\s+RepresentationStatus\s+@default\(ACTIVE\)/);
  assert.match(schema, /@@index\(\[ownerId, status\]\)/);
  assert.match(schema, /@@index\(\[identityId\]\)/);
  assert.match(schema, /@@index\(\[ownerId, identityId\]\)/);
  assert.doesNotMatch(schema, /model Representation \{[\s\S]*?@@unique\(\[identityId\]\)/);
  assert.doesNotMatch(schema, /enum RepresentationStatus \{[^}]*DISCOVER/);
  assert.match(schema, /enum RepresentationRelationshipPolicy \{[\s\S]*OPEN[\s\S]*MESSAGE_ONLY[\s\S]*CLOSED/);
  assert.match(schema, /relationshipPolicy\s+RepresentationRelationshipPolicy\s+@default\(OPEN\)/);
  assert.match(schema, /enum RepresentationVisibility \{[\s\S]*PRIVATE[\s\S]*DISCOVERABLE/);
  assert.match(schema, /visibility\s+RepresentationVisibility\s+@default\(PRIVATE\)/);
  assert.match(schema, /publishedAt\s+DateTime\?/);
});

test("visibility contract is strict and the migration is additive", () => {
  assert.deepEqual(parseSetRepresentationVisibilityInput({ visibility: "DISCOVERABLE", expectedUpdatedAt: "2026-08-02T10:00:00.000Z" }), { visibility: "DISCOVERABLE", expectedUpdatedAt: "2026-08-02T10:00:00.000Z" });
  assert.throws(() => parseSetRepresentationVisibilityInput({ visibility: "PUBLIC" }), DirectoryValidationError);
  assert.throws(() => parseSetRepresentationVisibilityInput({ visibility: "PRIVATE", status: "ACTIVE" }), DirectoryValidationError);
  const migration = source("prisma/migrations/20260802120000_add_representation_visibility/migration.sql");
  assert.match(migration, /CREATE TYPE "RepresentationVisibility" AS ENUM \('PRIVATE', 'DISCOVERABLE'\)/);
  assert.match(migration, /ADD COLUMN "visibility"[\s\S]*DEFAULT 'PRIVATE'/);
  assert.match(migration, /ADD COLUMN "publishedAt" TIMESTAMP\(3\)/);
  assert.doesNotMatch(migration, /UPDATE|DELETE|INSERT|DROP TABLE/i);
});

test("visibility transitions are explicit, idempotent and restricted to ACTIVE", () => {
  const now = new Date("2026-08-02T10:00:00.000Z");
  assert.deepEqual(representationVisibilityPatch({ status: "ACTIVE", visibility: "PRIVATE", publishedAt: null }, "DISCOVERABLE", now), { visibility: "DISCOVERABLE", publishedAt: now });
  assert.deepEqual(representationVisibilityPatch({ status: "ACTIVE", visibility: "DISCOVERABLE", publishedAt: now }, "DISCOVERABLE", now), {});
  assert.deepEqual(representationVisibilityPatch({ status: "ACTIVE", visibility: "DISCOVERABLE", publishedAt: now }, "PRIVATE", now), { visibility: "PRIVATE", publishedAt: null });
  assert.deepEqual(representationVisibilityPatch({ status: "ACTIVE", visibility: "PRIVATE", publishedAt: null }, "PRIVATE", now), {});
  assert.equal(representationVisibilityPatch({ status: "HIDDEN", visibility: "PRIVATE", publishedAt: null }, "DISCOVERABLE", now), null);
  assert.equal(representationVisibilityPatch({ status: "ARCHIVED", visibility: "PRIVATE", publishedAt: null }, "DISCOVERABLE", now), null);
});

test("relationship policy accepts only explicit values and keeps optimistic concurrency", () => {
  for (const relationshipPolicy of ["OPEN", "MESSAGE_ONLY", "CLOSED"] as const) {
    assert.deepEqual(parseSetRelationshipPolicyInput({ relationshipPolicy, expectedUpdatedAt: "2026-08-01T10:00:00.000Z" }), {
      relationshipPolicy,
      expectedUpdatedAt: "2026-08-01T10:00:00.000Z",
    });
  }
  assert.throws(() => parseSetRelationshipPolicyInput({ relationshipPolicy: "VOICE_ONLY" }), DirectoryValidationError);
  assert.throws(() => parseSetRelationshipPolicyInput({ relationshipPolicy: "OPEN", status: "ACTIVE" }), DirectoryValidationError);
});

test("relationship policy migration is minimal and preserves existing rows as OPEN", () => {
  const migration = source("prisma/migrations/20260801120000_add_representation_relationship_policy/migration.sql");
  assert.match(migration, /CREATE TYPE "RepresentationRelationshipPolicy" AS ENUM \('OPEN', 'MESSAGE_ONLY', 'CLOSED'\)/);
  assert.match(migration, /ADD COLUMN "relationshipPolicy"[\s\S]*NOT NULL DEFAULT 'OPEN'/);
  assert.doesNotMatch(migration, /UPDATE|DELETE|INSERT|DROP TABLE/i);
});

test("representation type describes context rather than duplicating identity type", () => {
  const contracts = source("lib/directory/contracts.ts");
  for (const type of ["PROFESSIONAL", "ORGANIZATION_REPRESENTATIVE", "ASSOCIATION", "PRIVATE", "OTHER"]) {
    assert.match(contracts, new RegExp(`"${type}"`));
  }
  assert.doesNotMatch(contracts, /REPRESENTATION_TYPES[\s\S]*?"PERSON"/);
});

test("create payload is trimmed, bounded and rejects empty or unknown data", () => {
  assert.deepEqual(parseCreateRepresentationInput({ type: "PROFESSIONAL", displayName: "  Cabinet Dupont  ", territory: " Lyon " }), {
    type: "PROFESSIONAL",
    displayName: "Cabinet Dupont",
    title: undefined,
    organizationName: undefined,
    description: undefined,
    territory: "Lyon",
  });
  for (const invalid of [
    {},
    { type: "PROFESSIONAL", displayName: " " },
    { type: "PROFESSIONAL", displayName: "A".repeat(121) },
    { type: "PROFESSIONAL", displayName: "Valide", title: " " },
    { type: "PROFESSIONAL", displayName: "Valide", visibility: "PUBLIC" },
  ]) assert.throws(() => parseCreateRepresentationInput(invalid), DirectoryValidationError);
  assert.throws(() => parseUpdateRepresentationInput({}), DirectoryValidationError);
  assert.throws(() => parseUpdateRepresentationInput({ description: "A".repeat(2_001) }), DirectoryValidationError);
});

test("service refuses creation without a linked GoodissimaIdentity", () => {
  const service = source("lib/directory/representation-service.ts");
  const repository = source("lib/directory/representation-repository.ts");
  assert.match(repository, /if \(!owner\?\.goodissimaIdentityId\) return null/);
  assert.match(service, /if \(!created\) throw new DirectoryServiceError\("IDENTITY_REQUIRED"/);
});

test("hide, restore and reversible archive keep archivedAt coherent and are idempotent", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");
  assert.deepEqual(representationTransitionPatch({ status: "ACTIVE", archivedAt: null }, "HIDDEN", now), { status: "HIDDEN", archivedAt: null, visibility: "PRIVATE", publishedAt: null });
  assert.deepEqual(representationTransitionPatch({ status: "HIDDEN", archivedAt: null }, "ACTIVE", now), { status: "ACTIVE", archivedAt: null, visibility: "PRIVATE", publishedAt: null });
  assert.deepEqual(representationTransitionPatch({ status: "ACTIVE", archivedAt: null }, "ARCHIVED", now), { status: "ARCHIVED", archivedAt: now, visibility: "PRIVATE", publishedAt: null });
  assert.deepEqual(representationTransitionPatch({ status: "ARCHIVED", archivedAt: now }, "ARCHIVED", now), {});
  assert.deepEqual(representationTransitionPatch({ status: "ARCHIVED", archivedAt: now }, "ACTIVE", now), { status: "ACTIVE", archivedAt: null, visibility: "PRIVATE", publishedAt: null });
});

test("transition contract is explicit", () => {
  assert.equal(canTransitionRepresentation("ACTIVE", "HIDDEN"), true);
  assert.equal(canTransitionRepresentation("HIDDEN", "ACTIVE"), true);
  assert.equal(canTransitionRepresentation("ACTIVE", "ARCHIVED"), true);
  assert.equal(canTransitionRepresentation("ARCHIVED", "ACTIVE"), true);
  assert.equal(canTransitionRepresentation("ARCHIVED", "HIDDEN"), false);
});

test("policy mutation is explicit, idempotent and does not patch status or archivedAt", () => {
  const service = source("lib/directory/representation-service.ts");
  assert.match(service, /export async function setRelationshipPolicy/);
  assert.match(service, /current\.relationshipPolicy === input\.relationshipPolicy/);
  const policyFunction = service.slice(service.indexOf("export async function setRelationshipPolicy"), service.indexOf("async function transitionRepresentation"));
  assert.doesNotMatch(policyFunction, /status\s*:|archivedAt\s*:/);
});

test("status transitions unpublish without changing relationship policy", () => {
  const service = source("lib/directory/representation-service.ts");
  const contracts = source("lib/directory/contracts.ts");
  assert.match(service, /publishRepresentation/);
  assert.match(service, /unpublishRepresentation/);
  const transitionPatch = contracts.slice(contracts.indexOf("export function representationTransitionPatch"));
  assert.match(transitionPatch, /visibility: "PRIVATE"/);
  assert.match(transitionPatch, /publishedAt: null/);
  assert.doesNotMatch(transitionPatch, /relationshipPolicy/);
});
