import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { productLifecycle, productObjectDefinitions, productObjectGuidance, productVoiceVocabulary } from "../lib/product-object-clarity.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("displays the complete product lifecycle in business order", () => {
  assert.deepEqual(productLifecycle.map((step) => step.label), ["Parcours", "Annonce", "Merge", "Demande de relation", "Relation", "Workspace"]);
  const component = source("components/ProductObjectClarity.tsx");
  assert.match(component, /aria-current/);
});

test("provides contextual definitions and guidance", () => {
  assert.match(productObjectDefinitions.journey, /Modèle de travail réutilisable/);
  assert.match(productObjectDefinitions.announcement, /Opportunité publiée ou partageable/);
  assert.match(productObjectDefinitions.relation, /Espace sécurisé de collaboration/);
  assert.match(productObjectDefinitions.workspace, /Espace opérationnel/);
  assert.match(productObjectGuidance.journey, /une ou plusieurs annonces/);
  assert.match(productObjectGuidance.announcement, /lien sécurisé/);
  assert.match(productObjectGuidance.relation, /mise en relation acceptée/);
});

test("separates announcement, journey and relation actions", () => {
  const announcement = source("components/AnnouncementActions.tsx");
  assert.match(announcement, /Modifier l'annonce/);
  assert.match(announcement, /Publier l'annonce/);
  assert.match(announcement, /Créer un lien sécurisé/);
  assert.match(announcement, /Archiver l'annonce/);
  const journey = source("app/templates/[templateId]/page.tsx");
  assert.match(journey, /Modifier le parcours/);
  assert.match(journey, /Analyser le parcours/);
  assert.match(journey, /Optimiser le parcours/);
  assert.match(source("components/TemplateLifecycleActions.tsx"), /Dupliquer le parcours/);
  const relation = source("components/RelationCaseWorkspace.tsx");
  for (const label of ["Conversation", "Documents", "Demandes", "Gouvernance", "Assistance IA"]) assert.match(relation, new RegExp(label));
});

test("provides cross navigation between product objects", () => {
  assert.match(source("app/templates/page.tsx"), /Voir les annonces/);
  assert.match(source("app/opportunities/page.tsx"), /sourceJourneyHref/);
  assert.match(source("components/LinkCard.tsx"), /Voir le parcours/);
  assert.match(source("app/relations/page.tsx"), /Voir l'annonce/);
  assert.match(source("components/RelationCaseWorkspace.tsx"), /Voir l'annonce/);
});

test("adds dashboard business-object counts", () => {
  const dashboard = source("app/dashboard/page.tsx");
  assert.match(dashboard, /Parcours actifs/);
  assert.match(dashboard, /Annonces publiées/);
  assert.match(dashboard, /Relations en cours/);
});

test("uses unambiguous voice-compatible vocabulary", () => {
  assert.deepEqual(productVoiceVocabulary, { journey: "un parcours", announcement: "une annonce", relation: "une relation" });
  assert.doesNotMatch(source("components/AnnouncementActions.tsx"), />Modifier</);
  assert.doesNotMatch(source("components/ManualJourneyEditor.tsx"), />Modifier</);
});

test("keeps technical details out of standard opportunity cards", () => {
  const standard = [source("components/OpportunityPreviewCard.tsx"), source("components/PublicOpportunityCard.tsx"), source("components/LinkCard.tsx")].join("\n");
  assert.doesNotMatch(standard, /CIRO|internal schema|raw fields|technical scoring/i);
  assert.match(source("components/LinkCard.tsx"), /debugMode/);
});

test("keeps existing business routes backwards compatible", () => {
  assert.match(source("components/PlatformNavigation.tsx"), /\/opportunities/);
  assert.match(source("components/PlatformNavigation.tsx"), /\/templates/);
  assert.match(source("components/PlatformNavigation.tsx"), /\/relations/);
});
