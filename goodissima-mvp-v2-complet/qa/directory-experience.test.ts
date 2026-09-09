import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const experience = read("components/directory/DirectoryExperience.tsx");
const card = read("components/directory/DirectoryProfileCard.tsx");
const page = read("app/(connected)/annuaire/page.tsx");
const actions = read("app/(connected)/annuaire/actions.ts");
const publicPage = read("app/(connected)/annuaire/[publicId]/page.tsx");

test("directory is positioned around search and voluntary enrollment", () => {
  assert.match(page, /Annuaire Goodissima/);
  assert.match(page, /Trouvez des personnes et des organisations/);
  assert.match(experience, /Rechercher dans l’Annuaire/);
  assert.match(experience, /Mon inscription dans l’Annuaire/);
  assert.doesNotMatch(`${page}\n${experience}`, /brique transversale|non activée comme annuaire|\bLLM\b|embedding|\bmatching\b/i);
});

test("search submits the closed deterministic contract and supports cursor pagination", () => {
  assert.match(experience, /fetch\("\/api\/directory\/search"/);
  for (const field of ["actorType", "professions", "skills", "languages", "locations", "qualifications", "certifications", "verificationRequirements"]) assert.match(experience, new RegExp(`\\b${field}\\b`));
  assert.match(experience, /nextCursor/);
  assert.match(experience, /Afficher plus/);
  assert.match(experience, /Aucun profil publié ne correspond actuellement à ces critères/);
  assert.doesNotMatch(experience, /résultat(?:s)? au total|totalCount/);
});

test("results render only the public directory DTO vocabulary", () => {
  for (const field of ["publicId", "actorType", "publicName", "attributes", "trustLevel", "matchReasons"]) assert.match(card, new RegExp(`\\b${field}\\b`));
  for (const forbidden of ["email", "subjectIdentityId", "credentialId", "claimId", "proof", "ownerId", "workspace", "portfolio", "relationCase"]) assert.doesNotMatch(card, new RegExp(forbidden, "i"));
  assert.match(card, /Déclaré/);
  assert.match(card, /✓ Vérifié/);
  assert.doesNotMatch(card, /profil vérifié|personne vérifiée/i);
  assert.match(card, /Pourquoi ce résultat/);
});

test("all person enrollment states and server commands are wired", () => {
  for (const copy of ["Vous n’êtes pas actuellement visible", "Votre inscription est en préparation", "Vous êtes visible", "Votre inscription n’est actuellement plus visible"]) assert.match(experience, new RegExp(copy));
  for (const command of ["createDirectoryDraftAction", "addDirectoryAttributeAction", "updateDirectoryAttributeAction", "publishDirectoryAttributeAction", "withdrawDirectoryAttributeAction", "publishDirectoryProfileAction", "disableDirectoryProfileAction", "republishDirectoryProfileAction"]) assert.match(experience, new RegExp(command));
  assert.match(experience, /window\.confirm/);
  assert.match(experience, /créée en brouillon/);
  assert.doesNotMatch(experience, /Créer (?:un|mon) profil Organisation/i);
  assert.match(actions, /^"use server"/);
  assert.match(actions, /directory-enrollment-commands/);
});

test("public profile uses publicId and the access boundary with a logical 404", () => {
  assert.match(publicPage, /getPublishedProfile\(params\.publicId\)/);
  assert.match(publicPage, /if \(!profile\) notFound\(\)/);
  assert.match(publicPage, /profile\.publicName/);
  assert.doesNotMatch(publicPage, /findUnique|findFirst|subjectIdentityId|credentialId|claimId|email/);
  assert.match(publicPage, /label: profile\.publicName/);
  assert.doesNotMatch(publicPage, /label: profile\.publicId/);
});

test("responsive, accessible and Boussole preparation hooks are explicit", () => {
  for (const widthClass of ["sm:", "md:", "lg:"]) assert.match(experience, new RegExp(widthClass));
  for (const accessibility of ["aria-labelledby", "aria-live", "role=\"alert\"", "focus-visible", "min-h-11"]) assert.match(experience, new RegExp(accessibility));
  for (const hook of ["directory-search", "directory-enrollment", "directory-first-result"]) assert.match(experience, new RegExp(`data-boussole-id=\\"${hook}\\"`));
  assert.match(publicPage, /data-boussole-id="directory-public-profile"/);
  assert.match(experience, /Utilisez Recherche Goodissima/);
});
