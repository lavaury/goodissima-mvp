import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  aiInstructionsCreationCopy,
  compareProposalVersions,
  domainGovernance,
  legacyDomainMapping,
  opportunityNavigation,
  opportunityVocabulary,
  publicAnnouncementHref,
  publicAnnouncementSections,
  relationshipWorkspaceHref,
} from "../lib/opportunity-domain.ts";

test("separates journeys, announcements and relationships in navigation", () => {
  assert.deepEqual(opportunityNavigation.map((item) => item.label), ["Mes annonces", "Mes parcours", "Mes relations"]);
  assert.deepEqual(legacyDomainMapping, { RelationTemplate: "journey", FormTemplate: "journey-form", GLink: "announcement", RelationCase: "relationship" });
});

test("uses business vocabulary instead of template internals", () => {
  assert.equal(opportunityVocabulary.publish, "Publier l'annonce");
  assert.equal(opportunityVocabulary.createSecureLink, "Créer un lien sécurisé pour cette annonce");
  assert.equal(opportunityVocabulary.objectives, "Objectifs de la recherche");
});

test("secure links point to the public announcement view without internal schema", () => {
  assert.equal(publicAnnouncementHref("t2-demo"), "/l/t2-demo");
  assert.deepEqual(publicAnnouncementSections, ["visual", "title", "location", "highlights", "description", "attachments", "verifiedLinks", "trust"]);
  assert.ok(!publicAnnouncementSections.includes("schema" as never));
  assert.ok(!publicAnnouncementSections.includes("rules" as never));
});

test("reports proposal additions, removals and modifications", () => {
  const changes = compareProposalVersions(
    { name: "T2", actors: [{ name: "Demandeur" }], documents: [{ name: "Identité" }] },
    { name: "T2 avec jardin", actors: [{ name: "Demandeur" }, { name: "Garant" }], documents: [] },
  );
  assert.deepEqual(changes.added, ["actors"]);
  assert.deepEqual(changes.removed, ["documents"]);
  assert.deepEqual(changes.modified, ["name"]);
});

test("opens a relationship workspace only after acceptance", () => {
  assert.equal(relationshipWorkspaceHref("DRAFT", "case-1"), null);
  assert.equal(relationshipWorkspaceHref("PENDING_REVIEW", "case-1"), null);
  assert.equal(relationshipWorkspaceHref("ACCEPTED", "case-1"), "/cases/case-1");
});

test("makes AI instructions available during creation", () => {
  assert.equal(aiInstructionsCreationCopy.title, "Comportement attendu de l'assistant IA");
  assert.match(aiInstructionsCreationCopy.helper, /aucune décision à votre place/);
});

test("preserves governance and prevents hidden automation", () => {
  assert.deepEqual(domainGovernance, { automaticPublication: false, automaticContact: false, automaticWorkflowExecution: false, announcementUsesOneJourney: true, secureLinkDistributes: "announcement" });
});

test("keeps technical journey details behind the advanced view", () => {
  const source = readFileSync(new URL("../app/templates/[templateId]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /searchParams\?\.advanced === "1"/);
  assert.match(source, /Ouvrir la vue avancée du parcours/);
});

test("renders the public announcement before the response form", () => {
  const source = readFileSync(new URL("../app/l/[slug]/page.tsx", import.meta.url), "utf8");
  assert.ok(source.indexOf("<PublicOpportunityCard") < source.indexOf("<CandidateForm"));
  assert.doesNotMatch(source, /Version active|raw form schema|Score relationnel/);
});

test("prefills secure-link fields from the selected announcement", () => {
  const source = readFileSync(new URL("../app/links/new/NewLinkForm.tsx", import.meta.url), "utf8");
  assert.match(source, /announcementTitle/);
  assert.match(source, /announcementCity/);
  assert.match(source, /announcementDescription/);
});

test("exposes AI instructions during creation and persists them on validation", () => {
  const designer = readFileSync(new URL("../components/AITemplateDesigner.tsx", import.meta.url), "utf8");
  const validationRoute = readFileSync(new URL("../app/api/templates/ai-generate/[generationId]/validate/route.ts", import.meta.url), "utf8");
  assert.match(designer, /Comportement attendu de l'assistant IA/);
  assert.match(validationRoute, /aiInstructions/);
});

test("persists the generated opportunity domain during human validation", () => {
  const designer = readFileSync(new URL("../lib/ai/template-designer.ts", import.meta.url), "utf8");
  const validationRoute = readFileSync(new URL("../app/api/templates/ai-generate/[generationId]/validate/route.ts", import.meta.url), "utf8");
  const publicationRoute = readFileSync(new URL("../app/api/templates/[templateId]/publish/route.ts", import.meta.url), "utf8");
  const archiveRoute = readFileSync(new URL("../app/api/templates/[templateId]/archive/route.ts", import.meta.url), "utf8");

  assert.match(designer, /opportunityCategory/);
  assert.match(designer, /preserveOpportunityCategory/);
  assert.match(validationRoute, /buildPersistedOpportunityPresentation/);
  assert.match(validationRoute, /generatedCategory:\s*draft\.opportunityCategory/);
  assert.match(validationRoute, /opportunityPresentation/);
  assert.match(publicationRoute, /buildTemplateSnapshot/);
  assert.doesNotMatch(publicationRoute, /opportunityPresentation:\s*\{\}/);
  assert.doesNotMatch(archiveRoute, /snapshot|opportunityPresentation/);
});
