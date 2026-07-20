import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simpleLinkSequences, simpleLinkSteps } from "../lib/boussole-simple-link.ts";
import { validateGlossaryReferences } from "../lib/boussole/glossary.ts";
import { isSimpleLinkRelationalEmailField } from "../lib/simple-link-fields.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("simple link builder stays independent from governed journeys and automation", () => {
  const api = source("app/api/links/simple/route.ts");
  const builder = source("app/links/simple/simple-link-builder.tsx");
  assert.match(builder, /Créer un lien simple/);
  assert.match(builder, /Aucune diffusion ne sera faite automatiquement/);
  assert.match(builder, /Dernière vérification/);
  assert.match(builder, /J’ai vérifié les champs et je confirme la création du lien/);
  assert.match(builder, /Rechercher des correspondances pour ce lien/);
  assert.match(builder, /Aucun contact, email ou dossier ne sera créé automatiquement/);
  assert.match(builder, /disabled=\{loading \|\| !validated/);
  assert.match(builder, /Aperçu live/);
  assert.match(builder, /Proposer des champs avec l’IA/);
  assert.match(builder, /Ajouter une section/);
  assert.match(builder, /Options avancées/);
  assert.match(builder, /Ce que verra la personne qui ouvre le lien/);
  assert.match(builder, /Partir d’un modèle/);
  assert.match(builder, /Choisir un modèle/);
  assert.match(builder, /Utiliser ce modèle/);
  assert.match(builder, /Importer un modèle ne crée aucun lien/);
  assert.match(api, /expiresAt/);
  assert.match(api, /admissionMode/);
  assert.doesNotMatch(api, /sendSecureLinkCreatedEmail|GovernedJourneyInvitation|CommunicationSession/);
  assert.doesNotMatch(api, /workspaceId:/);
  assert.match(api, /humanValidated/);
  assert.match(api, /automaticWorkflow: false/);
  assert.match(api, /matchingEnabled: body\.matchingEnabled === true/);
  assert.match(api, /matchingEnabledAtCreation: body\.matchingEnabled === true/);
  assert.match(api, /matchingStatus: body\.matchingEnabled === true \? "TO_ANALYZE" : "DISABLED"/);
  assert.doesNotMatch(api, /sendSecureLinkCreatedEmail|sendEmail|notification\.create/);
});

test("simple links use a dedicated public presentation with the real UTC civil expiration", () => {
  const page = source("app/l/[slug]/page.tsx");
  const card = source("components/PublicSimpleLinkCard.tsx");
  assert.match(page, /const isSimpleLink = linkRules\.simpleLink === true/);
  assert.match(page, /isSimpleLink \? \(/);
  assert.match(page, /PublicSimpleLinkCard/);
  assert.match(page, /Répondre via ce lien sécurisé/);
  assert.match(card, /Lien de contact sécurisé/);
  assert.match(card, /timeZone: "UTC"/);
  assert.match(card, /Ce lien est actif jusqu’au/);
  assert.match(card, /Ce lien reste actif jusqu’à sa désactivation par son propriétaire/);
  assert.doesNotMatch(card, /annonce|opportunité|À préciser|Provenance/i);
  assert.match(page, /<PublicOpportunityCard/);
});

test("new and legacy simple-link relational email fields are excluded", () => {
  const builder = source("app/links/simple/simple-link-builder.tsx");
  const creation = source("app/api/links/simple/route.ts");
  const page = source("app/l/[slug]/page.tsx");
  const cases = source("app/api/cases/route.ts");
  assert.doesNotMatch(builder, /value: "EMAIL", label: "Email"/);
  assert.doesNotMatch(builder, /label: "Email", type: "EMAIL"/);
  assert.match(builder, /filter\(\(field\) => field\.type !== "EMAIL"\)/);
  assert.match(creation, /isSimpleLinkRelationalEmailField\(\{ key, type \}\)/);
  assert.match(page, /isSimpleLinkRelationalEmailField/);
  assert.match(cases, /delete formSubmission\.answers\[key\]/);
  assert.equal(isSimpleLinkRelationalEmailField({ key: "email", type: "TEXT" }), true);
  assert.equal(isSimpleLinkRelationalEmailField({ key: "candidateEmail", type: "EMAIL" }), true);
  assert.equal(isSimpleLinkRelationalEmailField({ key: "contactEmail", type: "TEXT" }), true);
  assert.equal(isSimpleLinkRelationalEmailField({ key: "besoin", type: "TEXTAREA" }), false);
});

test("private notification remains explicit, optional and hidden from owner identity views", () => {
  const form = source("app/l/[slug]/candidate-form.tsx");
  const copy = source("lib/template-localization.ts");
  const cases = source("app/api/cases/route.ts");
  const caseList = source("app/cases/page.tsx");
  const workspace = source("components/RelationCaseWorkspace.tsx");
  assert.match(form, /useState\(false\)/);
  assert.match(form, /emailNotificationsConsent \? \(/);
  assert.match(copy, /Me prévenir par e-mail/);
  assert.match(copy, /Elle n’est pas communiquée au propriétaire du lien/);
  assert.match(cases, /wantsCandidateNotifications \? candidateNotificationEmail/);
  assert.match(caseList, /candidateEmailNotificationsEnabled \? null/);
  assert.match(workspace, /candidateEmailNotificationsEnabled \? null/);
});

test("only simple-link private notification channels are hidden from owner identity views", () => {
  const caseList = source("app/cases/page.tsx");
  const workspace = source("components/RelationCaseWorkspace.tsx");
  assert.match(caseList, /isSimpleLinkCase && item\.candidateEmailNotificationsEnabled \? null : item\.candidateEmail/);
  assert.match(workspace, /isSimpleLinkCase && item\.candidateEmailNotificationsEnabled \? null : item\.candidateEmail/);
  assert.match(caseList, /isSimpleLink\(item\.gLink\.rules\)/);
  assert.match(workspace, /isSimpleLink\(item\.gLink\.rules\)/);
});

test("simple-link submission keeps notification data outside functional answers and actor fields", () => {
  const cases = source("app/api/cases/route.ts");
  const messages = source("app/api/messages/route.ts");
  for (const key of ["notificationEmail", "notificationOptIn", "emailNotificationsConsent", "candidateNotificationEmail"]) {
    assert.match(cases, new RegExp(`"${key}"`));
  }
  assert.match(cases, /for \(const key of simpleLinkPrivateAnswerKeys\) ignoredEmailKeys\.add\(key\)/);
  assert.match(cases, /simple-link-actor-\$\{crypto\.randomUUID\(\)\}@goodissima\.local/);
  assert.match(cases, /senderEmail: relationActorEmail/);
  assert.match(cases, /uploadedByEmail: relationActorEmail/);
  assert.match(cases, /actorEmail: relationActorEmail/);
  assert.match(cases, /candidateEmail: relationActorEmail/);
  assert.match(cases, /candidateEmail,\s+candidateEmailNotificationsEnabled: wantsCandidateNotifications/);
  assert.doesNotMatch(cases, /senderEmail: candidateEmail|uploadedByEmail: candidateEmail|actorEmail: candidateEmail/);
  assert.match(messages, /relationCase\.candidateEmailNotificationsEnabled && candidateAccessIsActive/);
  assert.match(messages, /sendOwnerMessageToCandidateEmail\(\{[\s\S]+candidateEmail: relationCase\.candidateEmail/);
});

test("every retained Simple link Boussole step targets a real builder zone", () => {
  const builder = source("app/links/simple/simple-link-builder.tsx");
  assert.equal(simpleLinkSequences.length, 7);
  assert.equal(simpleLinkSteps.length, 40);
  for (const step of simpleLinkSteps) {
    assert.ok(step.targetId && builder.includes(step.targetId), `missing builder target ${step.targetId}`);
  }
  assert.deepEqual(validateGlossaryReferences(simpleLinkSteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
});

test("polishes the start, optional settings and verification order", () => {
  const start = simpleLinkSequences.find((sequence) => sequence.id === "start")!;
  const configure = simpleLinkSequences.find((sequence) => sequence.id === "configure-more")!;
  const verify = simpleLinkSequences.find((sequence) => sequence.id === "verify-create")!;
  assert.deepEqual(start.steps.slice(0, 2).map((step) => step.targetId), ["choose-simple-link-template", "search-simple-link-template"]);
  assert.ok(start.steps.some((step) => step.targetId === "create-without-template"));
  assert.ok(start.steps.some((step) => step.targetId === "suggest-fields-with-ai" && step.glossaryTermIds?.includes("intelligence-artificielle")));
  assert.deepEqual(start.steps.filter((step) => ["choose-simple-link-template", "create-without-template", "suggest-fields-with-ai"].includes(step.targetId!)).map((step) => step.targetId), ["choose-simple-link-template", "create-without-template", "suggest-fields-with-ai"]);
  assert.deepEqual(configure.steps.map((step) => step.targetId), ["simple-link-advanced-options"]);
  assert.deepEqual(verify.steps.slice(0, 4).map((step) => step.targetId), ["simple-link-final-check-section", "confirm-simple-link", "create-simple-link", "create-simple-link"]);
  assert.ok(simpleLinkSteps.some((step) => step.targetId === "add-simple-link-section" && step.glossaryTermIds?.includes("section-de-formulaire")));
  const build = simpleLinkSequences.find((sequence) => sequence.id === "build-form")!;
  const addFieldIndex = build.steps.findIndex((step) => step.targetId === "add-simple-link-field");
  assert.equal(build.steps[addFieldIndex + 1]?.targetId, "add-simple-link-section");
});

test("executes the IA explanation in the initial Commencer state", () => {
  const start = simpleLinkSequences.find((sequence) => sequence.id === "start")!;
  const initiallyVisibleTargets = new Set(["choose-simple-link-template", "create-without-template", "suggest-fields-with-ai", "simple-link-governance-reminder"]);
  const resolved = start.steps.filter((step) => initiallyVisibleTargets.has(step.targetId!));
  assert.deepEqual(resolved.slice(0, 3).map((step) => step.targetId), ["choose-simple-link-template", "create-without-template", "suggest-fields-with-ai"]);
  const ia = resolved[2];
  assert.equal(ia.title, "Proposer des champs avec l’IA");
  assert.deepEqual(ia.glossaryTermIds, ["intelligence-artificielle", "champ", "validation-humaine"]);
});

test("Simple link Boussole states remain descriptive and never execute builder actions", () => {
  const boussole = source("components/ContextualBoussole.tsx");
  assert.match(boussole, /targetStates/);
  assert.match(boussole, /getClientRects\(\)\.length > 0/);
  assert.match(boussole, /scrollIntoView/);
  assert.doesNotMatch(boussole, /\.click\(\)|createLink\(|useTemplate\(|proposeFields\(/);
});
