import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("database enforces owner identity linkage and enables deny-by-default browser RLS", () => {
  const migration = source("prisma/migrations/20260731120000_add_directory_representations/migration.sql");
  assert.match(migration, /FOREIGN KEY \("ownerId", "identityId"\)[\s\S]*REFERENCES "User"\("id", "goodissimaIdentityId"\)/);
  assert.match(migration, /ALTER TABLE "Representation" ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /Representation_archivedAt_check/);
  assert.doesNotMatch(migration, /goodissima_(profiles|requests|relations|channels|entry_doors|discovery_contexts|history_events)"\s+(RENAME|ALTER|DROP|INSERT|UPDATE|DELETE)/i);
});

test("repository scopes every representation read and mutation by ownerId", () => {
  const repository = source("lib/directory/representation-repository.ts");
  assert.match(repository, /where: \{ ownerId \}/);
  assert.match(repository, /where: \{ id, ownerId \}/);
  assert.match(repository, /id,\s*ownerId,/);
  assert.match(repository, /goodissimaIdentityId: \{ not: null \}/);
  assert.match(repository, /orderBy: \[\{ updatedAt: "desc" \}, \{ id: "asc" \}\]/);
  assert.doesNotMatch(repository, /findUnique\(\{\s*where: \{ id \}/);
  assert.doesNotMatch(repository, /goodissimaMvp|goodissima_profiles|goodissima_requests/);
});

test("API is authenticated, owner-derived and exposes no owner or identity identifiers", () => {
  const collection = source("app/api/directory/representations/route.ts");
  const detail = source("app/api/directory/representations/[representationId]/route.ts");
  const api = source("lib/directory/api.ts");
  for (const route of [collection, detail]) {
    assert.match(route, /getCurrentPrismaUser\(\)/);
    assert.doesNotMatch(route, /body\.ownerId|body\.identityId/);
  }
  assert.doesNotMatch(api, /ownerId|identityId/);
  for (const field of ["id", "type", "displayName", "title", "organizationName", "description", "territory", "status", "relationshipPolicy", "visibility", "publishedAt", "createdAt", "updatedAt", "archivedAt"]) {
    assert.match(api, new RegExp(`\\b${field}\\b`));
  }
});

test("routes map stable 400, 404, 409 and 500 errors without stack or Prisma details", () => {
  const errors = source("lib/directory/api.ts");
  assert.match(errors, /status: 400/);
  assert.match(errors, /\? 404/);
  assert.match(errors, /\? 409/);
  assert.match(errors, /status: 500/);
  assert.doesNotMatch(errors, /stack/);
  assert.doesNotMatch(errors, /PrismaClientKnownRequestError/);
});

test("directory has no discoverability or automatic business side effects", () => {
  const directoryCode = [
    source("lib/directory/contracts.ts"),
    source("lib/directory/representation-repository.ts"),
    source("lib/directory/representation-service.ts"),
    source("app/api/directory/representations/route.ts"),
    source("app/api/directory/representations/[representationId]/route.ts"),
  ].join("\n");
  assert.doesNotMatch(directoryCode, /ContactRequest|RepresentationContact|prisma\.message|CommunicationSession|MatchingRun|MatchingResult|\bnotification\b|\binvitation\b/i);
  assert.doesNotMatch(directoryCode, /email|phone|telephone/i);
});

test("global projection is minimal, bounded and limited to ACTIVE DISCOVERABLE rows", () => {
  const repository = source("lib/directory/representation-repository.ts");
  const contracts = source("lib/directory/contracts.ts");
  assert.match(repository, /where: \{ status: "ACTIVE", visibility: "DISCOVERABLE", publishedAt: \{ not: null \} \}/);
  assert.match(repository, /Math\.min\(limit, 50\)/);
  assert.match(repository, /orderBy: \[\{ publishedAt: "desc" \}, \{ id: "asc" \}\]/);
  const publicSelect = repository.slice(repository.indexOf("const publicRepresentationSelect"), repository.indexOf("export type ConditionalUpdateResult"));
  assert.doesNotMatch(publicSelect, /ownerId|identityId|email|phone|claims|archivedAt|updatedAt|createdAt/);
  const publicContract = contracts.slice(contracts.indexOf("export type PublicRepresentationSummary"), contracts.indexOf("export class DirectoryValidationError"));
  assert.doesNotMatch(publicContract, /ownerId|identityId|email|phone|claims|archivedAt|expectedUpdatedAt/);
});

test("foreign ids resolve as not found through owner-scoped lookups", () => {
  const service = source("lib/directory/representation-service.ts");
  const repository = source("lib/directory/representation-repository.ts");
  assert.match(service, /if \(!found\).*"NOT_FOUND"/);
  assert.match(repository, /findForOwner\(ownerId, id\)/);
  assert.match(repository, /findFirst\(\{ where: \{ id, ownerId \}/);
});
