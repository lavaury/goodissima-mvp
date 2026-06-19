import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCandidateMessageFallback,
  candidateFieldsFromTemplateDraft,
  checkCandidatePublicationSafety,
  deriveCandidateSubmissionFields,
  findCandidatePublicationSafetyIssues,
  findMissingRequiredCandidateField,
  formatMissingRequiredFieldError,
  getCandidateSystemFieldSubmissionPresence,
  type CandidateFormField,
} from "../lib/candidate-form-safety.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const visibleRequiredFields: CandidateFormField[] = [
  { key: "fullName", label: "Nom complet", type: "TEXT", required: true, defaultValue: null, conditionalRules: [] },
  { key: "email", label: "Email", type: "EMAIL", required: true, defaultValue: null, conditionalRules: [] },
  { key: "message", label: "Message", type: "TEXTAREA", required: true, defaultValue: null, conditionalRules: [] },
];

test("required visible field submitted successfully", () => {
  const missing = findMissingRequiredCandidateField(visibleRequiredFields, {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    message: "Bonjour",
  });

  assert.equal(missing, null);
});

test("missing required visible field returns exact id, label and French message", () => {
  const missing = findMissingRequiredCandidateField(visibleRequiredFields, {
    fullName: "Ada Lovelace",
    email: "",
    message: "Bonjour",
  });

  assert.deepEqual(missing, { id: "email", label: "Email", code: "REQUIRED_FIELD_MISSING" });
  assert.equal(formatMissingRequiredFieldError(missing!), "Le champ obligatoire « Email » est manquant.");
});

test("hidden required field does not block candidate submission but blocks publication", () => {
  const fields: CandidateFormField[] = [
    { key: "wantsFollowUp", label: "Demande un suivi", type: "CHECKBOX", required: false, defaultValue: "false", conditionalRules: [] },
    {
      key: "followUpDetails",
      label: "Détails du suivi",
      type: "TEXTAREA",
      required: true,
      defaultValue: null,
      conditionalRules: [{ field: "wantsFollowUp", operator: "equals", value: true, action: "SHOW" }],
    },
  ];

  assert.equal(findMissingRequiredCandidateField(fields, { wantsFollowUp: false, followUpDetails: "" }), null);
  assert.deepEqual(findCandidatePublicationSafetyIssues(fields).map((field) => field.id), ["followUpDetails"]);
  const safety = checkCandidatePublicationSafety([...visibleRequiredFields, ...fields]);
  assert.equal(safety.publishable, false);
  assert.equal(safety.statusLabel, "Correction requise");
  assert.equal(
    safety.error,
    "Ce parcours généré par IA n’est pas encore publiable : le champ « Détails du suivi » doit être corrigé.",
  );
});

test("publication safety accepts a safely submittable candidate form", () => {
  const safety = checkCandidatePublicationSafety(visibleRequiredFields);

  assert.equal(safety.publishable, true);
  assert.equal(safety.statusLabel, "Prêt à publier");
  assert.deepEqual(safety.issues, []);
  assert.equal(safety.error, null);
});

test("AI-generated anonymous form is publishable without name or email", () => {
  const safety = checkCandidatePublicationSafety([
    { key: "localisation", label: "Localisation souhaitée", type: "TEXT", required: true, defaultValue: null, conditionalRules: [] },
    { key: "budget", label: "Budget", type: "NUMBER", required: true, defaultValue: null, conditionalRules: [] },
  ]);

  assert.equal(safety.publishable, true);
  assert.deepEqual(safety.issues, []);
});

test("optional name and email do not block publication", () => {
  const safety = checkCandidatePublicationSafety([
    { key: "nomComplet", label: "Nom complet", type: "TEXT", required: false, defaultValue: null, conditionalRules: [] },
    { key: "email", label: "Email", type: "EMAIL", required: false, defaultValue: null, conditionalRules: [] },
    { key: "besoin", label: "Besoin", type: "TEXTAREA", required: true, defaultValue: null, conditionalRules: [] },
  ]);

  assert.equal(safety.publishable, true);
});

test("publication safety accepts French AI system field aliases", () => {
  const safety = checkCandidatePublicationSafety([
    { key: "nomComplet", label: "Nom complet", type: "TEXT", required: true, defaultValue: null, conditionalRules: [] },
    { key: "email", label: "Adresse e-mail", type: "EMAIL", required: true, defaultValue: null, conditionalRules: [] },
    { key: "besoin", label: "Description du besoin", type: "TEXTAREA", required: true, defaultValue: null, conditionalRules: [] },
  ]);

  assert.equal(safety.publishable, true);
});

test("published template compatibility derives candidate fields from French AI aliases", () => {
  const derived = deriveCandidateSubmissionFields({
    nomComplet: "Ada Lovelace",
    email: "ada@example.com",
    besoin: "Je souhaite répondre à cette opportunité.",
  });

  assert.equal(derived.candidateName, "Ada Lovelace");
  assert.equal(derived.candidateEmail, "ada@example.com");
  assert.equal(derived.message, "Je souhaite répondre à cette opportunité.");
});

test("publication safety blocks invalid and duplicate field ids", () => {
  const fields: CandidateFormField[] = [
    ...visibleRequiredFields,
    { key: "bad id", label: "Identifiant invalide", type: "TEXT", required: false, defaultValue: null, conditionalRules: [] },
    { key: "email", label: "Email bis", type: "EMAIL", required: false, defaultValue: null, conditionalRules: [] },
  ];

  const safety = checkCandidatePublicationSafety(fields);

  assert.equal(safety.publishable, false);
  assert.deepEqual(
    safety.issues.slice(0, 3).map((issue) => issue.code),
    ["DUPLICATE_FIELD_ID", "INVALID_FIELD_ID", "DUPLICATE_FIELD_ID"],
  );
});

test("publication safety blocks unsupported required field types before normalization", () => {
  const fields = candidateFieldsFromTemplateDraft({
    fields: [
      { key: "fullName", label: "Nom complet", type: "TEXT", required: true },
      { key: "email", label: "Email", type: "EMAIL", required: true },
      { key: "message", label: "Message", type: "TEXTAREA", required: true },
      { key: "signature", label: "Signature", type: "SIGNATURE", required: true },
    ],
  });

  const safety = checkCandidatePublicationSafety(fields);

  assert.equal(safety.publishable, false);
  assert.equal(safety.issues.find((issue) => issue.id === "signature")?.code, "UNSUPPORTED_REQUIRED_FIELD_TYPE");
});

test("identityRequired blocks missing compatible identity mappings", () => {
  const fields: CandidateFormField[] = [
    { key: "fullName", label: "Nom complet", type: "TEXT", required: true, defaultValue: null, conditionalRules: [] },
    { key: "email", label: "Email", type: "TEXT", required: true, defaultValue: null, conditionalRules: [] },
    { key: "project", label: "Projet", type: "TEXTAREA", required: true, defaultValue: null, conditionalRules: [] },
  ];

  const safety = checkCandidatePublicationSafety(fields, { identityRequired: true });

  assert.equal(safety.publishable, false);
  assert.deepEqual(
    safety.issues.filter((issue) => issue.code === "MISSING_SYSTEM_MAPPING").map((issue) => issue.systemField),
    ["candidateEmail"],
  );
});

test("identityRequired requires visible required name and email fields", () => {
  const safety = checkCandidatePublicationSafety([
    { key: "fullName", label: "Nom complet", type: "TEXT", required: false, defaultValue: null, conditionalRules: [] },
    { key: "email", label: "Email", type: "EMAIL", required: true, defaultValue: null, conditionalRules: [] },
  ], { identityRequired: true });

  assert.equal(safety.publishable, false);
  assert.equal(safety.issues.find((issue) => issue.systemField === "candidateName")?.code, "MISSING_SYSTEM_MAPPING");
});

test("published template compatibility derives candidate fields from alternate field ids", () => {
  const derived = deriveCandidateSubmissionFields({
    companyName: "Goodissima",
    contactEmail: "contact@goodissima.test",
    request: "Je souhaite répondre à cette opportunité.",
  });

  assert.equal(derived.candidateName, "Goodissima");
  assert.equal(derived.candidateEmail, "contact@goodissima.test");
  assert.equal(derived.message, "Je souhaite répondre à cette opportunité.");
  assert.equal(derived.candidateEmailFieldId, "contactEmail");
  assert.equal(derived.messageFieldId, "request");
});

test("public form without rendered Nom complet does not produce a missing Nom complet submission error", () => {
  const renderedFields: CandidateFormField[] = [
    { key: "localisationSouhaitee", label: "Localisation souhaitée", type: "TEXT", required: true, defaultValue: null, conditionalRules: [] },
    { key: "budgetMinimum", label: "Budget minimum", type: "NUMBER", required: true, defaultValue: null, conditionalRules: [] },
    { key: "commentaires", label: "Commentaires", type: "TEXTAREA", required: false, defaultValue: null, conditionalRules: [] },
  ];
  const answers = {
    localisationSouhaitee: "Paris",
    budgetMinimum: "1200",
    commentaires: "Entrée souhaitée en septembre.",
  };

  assert.equal(findMissingRequiredCandidateField(renderedFields, answers), null);
  assert.deepEqual(getCandidateSystemFieldSubmissionPresence(answers), {
    candidateName: false,
    candidateEmail: false,
    message: false,
  });
  assert.deepEqual(deriveCandidateSubmissionFields(answers), {
    candidateName: "",
    candidateNameFieldId: null,
    candidateEmail: "",
    candidateEmailFieldId: null,
    message: "",
    messageFieldId: null,
  });
  assert.match(buildCandidateMessageFallback(answers), /Paris/);
});

test("empty optional identity fields are valid candidate answers", () => {
  const fields: CandidateFormField[] = [
    { key: "nomComplet", label: "Nom complet", type: "TEXT", required: false, defaultValue: null, conditionalRules: [] },
    { key: "email", label: "Email", type: "EMAIL", required: false, defaultValue: null, conditionalRules: [] },
    { key: "motivation", label: "Motivation", type: "TEXTAREA", required: true, defaultValue: null, conditionalRules: [] },
  ];
  const answers = { nomComplet: "", email: "", motivation: "Je souhaite proposer ma candidature." };

  assert.equal(findMissingRequiredCandidateField(fields, answers), null);
  assert.deepEqual(deriveCandidateSubmissionFields(answers), {
    candidateName: "",
    candidateNameFieldId: null,
    candidateEmail: "",
    candidateEmailFieldId: null,
    message: "",
    messageFieldId: null,
  });
});

test("published template with hidden required system name field is blocked", () => {
  const safety = checkCandidatePublicationSafety([
    { key: "wantsIdentity", label: "Partager mon identité", type: "CHECKBOX", required: false, defaultValue: "false", conditionalRules: [] },
    {
      key: "fullName",
      label: "Nom complet",
      type: "TEXT",
      required: true,
      defaultValue: null,
      conditionalRules: [{ field: "wantsIdentity", operator: "equals", value: true, action: "SHOW" }],
    },
    { key: "email", label: "Email", type: "EMAIL", required: true, defaultValue: null, conditionalRules: [] },
    { key: "message", label: "Message", type: "TEXTAREA", required: true, defaultValue: null, conditionalRules: [] },
  ]);

  assert.equal(safety.publishable, false);
  assert.equal(safety.issues.find((issue) => issue.id === "fullName")?.code, "REQUIRED_FIELD_NOT_RENDERED");
});

test("candidate form keeps field ids in payload and sends the displayed template version", () => {
  const form = source("app/l/[slug]/candidate-form.tsx");
  const page = source("app/l/[slug]/page.tsx");
  const route = source("app/api/cases/route.ts");

  assert.match(form, /result\[field\.key\]/);
  assert.match(form, /deriveCandidateSubmissionFields\(submissionAnswers\)/);
  assert.match(form, /templateVersionId/);
  assert.match(page, /displayedTemplateVersionId/);
  assert.match(route, /parseTemplateSnapshot/);
  assert.match(route, /missingField/);
  assert.doesNotMatch(route, /submittedSystemFields\.candidateName/);
  assert.doesNotMatch(route, /candidateName_missing/);
  assert.doesNotMatch(route, /candidateEmail_missing/);
  assert.doesNotMatch(route, /Candidat Goodissima/);
  assert.match(route, /candidateName,\s*candidateEmail,/);
  assert.match(route, /createFormSubmission\([\s\S]+answers: formSubmission\.answers/);
  assert.doesNotMatch(form, /Code : \$\{code\}/);
});

test("default public form keeps identity optional when no template fields exist", () => {
  const page = source("app/l/[slug]/page.tsx");

  assert.match(page, /key: "fullName"[\s\S]+label: "Nom complet"[\s\S]+required: false/);
  assert.match(page, /key: "email"[\s\S]+required: false/);
  assert.match(page, /key: "message"[\s\S]+required: true/);
});

test("AI template routes run candidate form safety before draft validation and publication", () => {
  const generateRoute = source("app/api/templates/ai-generate/route.ts");
  const validateRoute = source("app/api/templates/ai-generate/[generationId]/validate/route.ts");
  const publishRoute = source("app/api/templates/[templateId]/publish/route.ts");
  const designer = source("components/AITemplateDesigner.tsx");
  const detailPage = source("app/templates/[templateId]/page.tsx");
  const templateDesigner = source("lib/ai/template-designer.ts");

  assert.match(generateRoute, /checkCandidatePublicationSafety/);
  assert.match(generateRoute, /identityRequired/);
  assert.match(validateRoute, /preValidationSafety/);
  assert.match(validateRoute, /validateTemplateDraftQuality/);
  assert.match(validateRoute, /preValidationSafety[\s\S]+validateTemplateDraftQuality/);
  assert.match(publishRoute, /CANDIDATE_FORM_SAFETY_BLOCKED/);
  assert.match(publishRoute, /candidateIdentityRequiredFromSnapshotMetadata/);
  assert.doesNotMatch(publishRoute, /REQUIRED_FIELD_MISSING/);
  assert.match(designer, /Prêt à publier/);
  assert.match(designer, /Correction requise/);
  assert.match(detailPage, /candidateFormSafety\.statusLabel/);
  assert.match(templateDesigner, /Préserve l'anonymat du candidat par défaut/);
  assert.match(templateDesigner, /preserveAnonymousIdentityByDefault/);
  assert.match(templateDesigner, /identityRequired: false/);
});
