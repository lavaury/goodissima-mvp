import test from "node:test";
import assert from "node:assert/strict";
import { simpleLinkTemplateCategories, simpleLinkTemplates } from "../lib/simple-link-templates.ts";

test("official library contains 32 versioned internal templates across 11 categories", () => {
  assert.equal(simpleLinkTemplates.length, 32);
  assert.equal(simpleLinkTemplateCategories.length, 11);
  assert.equal(new Set(simpleLinkTemplates.map((item) => item.id)).size, 32);
  assert.ok(simpleLinkTemplates.every((item) => item.fields.length > 0 && item.tags.length > 0));
});

test("conversation and relationship templates are searchable, editable data", () => {
  const conversation = simpleLinkTemplates.find((item) => item.title === "Conversation sécurisée");
  const relationship = simpleLinkTemplates.find((item) => item.title === "Je cherche une relation");
  assert.deepEqual(conversation?.fields.map((field) => field.label), ["Nom complet", "Email", "Message", "Document joint"]);
  assert.equal(conversation?.fields.find((field) => field.label === "Message")?.required, true);
  assert.equal(conversation?.fields.find((field) => field.label === "Document joint")?.type, "FILE");
  assert.ok(conversation?.tags.includes("message"));
  assert.ok(relationship?.tags.includes("mise en contact"));
  assert.equal(relationship?.fields.find((field) => field.label === "Rayon souhaité en km")?.validationRules?.mode, "INDICATIVE");
  assert.equal(relationship?.fields.find((field) => field.label === "Type de relation recherchée")?.options?.length, 7);
  assert.equal(relationship?.matchingRecommended, true);
});

test("requested flagship templates contain editable typed fields", () => {
  const apartment = simpleLinkTemplates.find((item) => item.title === "Recherche appartement à louer");
  const car = simpleLinkTemplates.find((item) => item.title === "Vendre une voiture");
  const documents = simpleLinkTemplates.find((item) => item.title === "Collecte de documents administratifs");
  const babysitter = simpleLinkTemplates.find((item) => item.title === "Recherche baby-sitter");
  assert.ok(apartment?.fields.some((field) => field.label === "Budget maximum" && field.validationRules?.operator === "LTE"));
  assert.ok(car?.fields.some((field) => field.label === "Photos" && field.type === "FILE"));
  assert.ok(documents?.fields.some((field) => field.label === "Pièce jointe" && field.type === "FILE" && field.required));
  assert.ok(babysitter);
});

test("templates are data only and contain no automation configuration", () => {
  const serialized = JSON.stringify(simpleLinkTemplates);
  assert.doesNotMatch(serialized, /sendEmail|notification|workflow|candidateAccess/i);
});
