import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { directoryRuntimeContext, directorySequences } from "../lib/boussole-directory.ts";
import { boussoleRegistry, getBoussoleJourneyVersion } from "../lib/boussole/registry.ts";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("registers four independently resumable directory journeys at v1", () => {
  assert.deepEqual(directorySequences.map((item) => item.id), ["discover-directory", "search-directory", "understand-directory-result", "manage-directory-enrollment"]);
  for (const journey of directorySequences) { assert.equal(getBoussoleJourneyVersion(journey.id), 1); assert.ok(journey.steps.every((step) => step.id && step.targetId)); }
  assert.deepEqual(boussoleRegistry.find((entry) => entry.manifest.pageId === "directory")?.manifest.routes, ["/annuaire", "/annuaire/:publicId"]);
});

test("uses EMPTY, real POPULATED results and a real FOCUSED public profile", () => {
  assert.equal(directoryRuntimeContext("directory", "/annuaire", []).pageState, "EMPTY");
  assert.equal(directoryRuntimeContext("directory", "/annuaire", ["directory-first-result"]).pageState, "POPULATED");
  assert.equal(directoryRuntimeContext("directory", "/annuaire/real-public-id", ["directory-public-profile"]).pageState, "FOCUSED");
});

test("targets real hooks and creates no fake profile or business action", () => {
  const source = [read("components/directory/DirectoryExperience.tsx"), read("app/(connected)/annuaire/[publicId]/page.tsx")].join("\n");
  for (const target of new Set(directorySequences.flatMap((journey) => journey.steps.map((step) => step.targetId)))) assert.ok(target && source.includes(target), `missing ${target}`);
  const guide = read("lib/boussole-directory.ts");
  assert.doesNotMatch(guide, /createDirectory|publishDirectory|disableDirectory|fetch\(|prisma|demo profile|profil fictif/i);
  assert.match(guide, /Recherche Goodissima|opportunités/);
});
