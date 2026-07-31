import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../prisma/migrations/20260731160000_repair_directory_representations/migration.sql", import.meta.url),
  "utf8",
);

test("repair migration is additive and contains no destructive statement", () => {
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|TYPE|INDEX|CONSTRAINT)\b/i);
  assert.doesNotMatch(migration, /\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bUPDATE\s+public\.|\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(migration, /goodissima_(profiles|requests|relations|channels|entry_doors|discovery_contexts|history_events)/i);
});

test("repair migration conditionally covers both enums and the table", () => {
  assert.match(migration, /pg_type[\s\S]*RepresentationType/);
  assert.match(migration, /pg_type[\s\S]*RepresentationStatus/);
  assert.match(migration, /CREATE TYPE public\."RepresentationType" AS ENUM/);
  assert.match(migration, /CREATE TYPE public\."RepresentationStatus" AS ENUM/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\."Representation"/);
  assert.match(migration, /"status" public\."RepresentationStatus" NOT NULL DEFAULT 'ACTIVE'/);
  assert.match(migration, /"archivedAt" TIMESTAMP\(3\)/);
});

test("repair migration conditionally restores every constraint and index", () => {
  for (const constraint of [
    "Representation_pkey",
    "Representation_archivedAt_check",
    "Representation_ownerId_identityId_fkey",
    "Representation_identityId_fkey",
  ]) {
    assert.match(migration, new RegExp(`conname = '${constraint}'`));
    assert.match(migration, new RegExp(`ADD CONSTRAINT "${constraint}"`));
  }
  for (const index of [
    "User_id_goodissimaIdentityId_key",
    "Representation_ownerId_status_idx",
    "Representation_identityId_idx",
    "Representation_ownerId_identityId_idx",
    "Representation_ownerId_updatedAt_idx",
  ]) assert.match(migration, new RegExp(`INDEX IF NOT EXISTS "${index}"`));
  assert.match(migration, /FOREIGN KEY \("ownerId", "identityId"\)[\s\S]*ON DELETE CASCADE ON UPDATE RESTRICT/);
  assert.match(migration, /FOREIGN KEY \("identityId"\)[\s\S]*ON DELETE RESTRICT ON UPDATE CASCADE/);
  assert.match(migration, /"status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL/);
  assert.match(migration, /ALTER TABLE public\."Representation" ENABLE ROW LEVEL SECURITY/);
});
