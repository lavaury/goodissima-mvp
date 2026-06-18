import assert from "node:assert/strict";
import test from "node:test";
import { OPPORTUNITY_BUSINESS_WORDING, OPPORTUNITY_CATEGORY_VISUALS, OPPORTUNITY_EMPTY_STATES, OPPORTUNITY_PREVIEW_TABS, OPPORTUNITY_PRESENTATION_SCHEMAS, assistantReturnHref, buildOpportunityCategoryMetrics, buildOpportunityPreview, buildPersistedOpportunityPresentation, draftPreviewHref, enrichOpportunityPresentation, extractOpportunityHighlights, inferOpportunityCategory, inferOpportunityType, opportunityEditHref, opportunityHeroImage, opportunityReadiness, type OpportunityCategory } from "../lib/opportunity-preview.ts";
import type { TemplateSnapshot } from "../lib/template-snapshots.ts";

const snapshot: TemplateSnapshot = {
  relationTemplate: { id: "rt1", key: "LOCATION_T3", name: "Location T3 Lyon", description: "Trouver un locataire certifié pour un T3." },
  formTemplate: { id: "ft1", key: "LOCATION_T3_FORM", name: "Location T3 Lyon", description: "Trouver un locataire certifié pour un T3." },
  fields: [],
  design: {
    actors: [{ name: "Propriétaire", role: "Valide le dossier" }, { name: "Locataire", role: "Fournit les justificatifs" }],
    stages: [{ name: "Validation", objective: "Contrôler le dossier", exitCondition: "Dossier complet et relu" }],
    documents: [{ name: "Justificatif de revenus", required: true, stage: 1 }, { name: "Présentation libre", required: false, stage: 1 }],
    relationalRequests: [],
    kpis: [{ name: "Délai de validation", unit: "jours", description: "Temps de revue" }],
  },
  metadata: {
    snapshotVersion: 2,
    generation: { inputDescription: "Je cherche un locataire pour un appartement à Lyon", provider: "mock" },
    opportunityPresentation: { city: "Lyon", propertyType: "Appartement T3", surface: "67 m²", rent: "1 180 €", charges: "80 €", photos: ["photo-demo.jpg"], attachments: ["diagnostic.pdf"], verifiedLinks: ["https://example.test/annonce"] },
  },
};

test("builds a complete draft opportunity preview from generated data", () => {
  const preview = buildOpportunityPreview(snapshot);
  assert.equal(preview.title, "Location T3 Lyon");
  assert.equal(preview.summary, "Trouver un locataire certifié pour un T3.");
  assert.equal(preview.opportunityType, "Immobilier et location");
  assert.equal(preview.city, "Lyon");
  assert.equal(preview.propertyType, "Appartement T3");
  assert.deepEqual(preview.keyMetrics, [{ label: "Surface", value: "67 m²" }, { label: "Loyer", value: "1 180 €" }, { label: "Charges", value: "80 €" }, { label: "Pièces", value: "À préciser" }]);
  assert.equal(preview.publicationStatus, "Brouillon · Non publiée");
  assert.equal(preview.readiness, "Prêt à publier");
  assert.equal(preview.status, "DRAFT");
  assert.equal(preview.actors.length, 2);
  assert.deepEqual(preview.requiredDocuments, ["Justificatif de revenus"]);
  assert.ok(preview.validationCriteria.includes("Dossier complet et relu"));
  assert.deepEqual(preview.photos, ["photo-demo.jpg"]);
  assert.deepEqual(preview.attachments, ["diagnostic.pdf"]);
  assert.deepEqual(preview.verifiedLinks, ["https://example.test/annonce"]);
});

test("builds a published opportunity preview from persisted version state", () => {
  const publishedAt = "2026-06-15T10:30:00.000Z";
  const preview = buildOpportunityPreview(snapshot, { isPublished: true, publishedAt });
  assert.equal(preview.status, "PUBLISHED");
  assert.equal(preview.publicationStatus, "Publiée");
  assert.equal(preview.publishedAt, publishedAt);
  assert.ok(preview.trustIndicators.includes("Publication enregistrée"));
  assert.ok(preview.governance.validation.includes("Annonce publiée"));
});

test("separates public announcement, journey and governance content", () => {
  assert.deepEqual(OPPORTUNITY_PREVIEW_TABS.map((tab) => tab.label), ["Annonce", "Parcours", "Gouvernance"]);
  const preview = buildOpportunityPreview(snapshot);
  assert.ok(preview.stages.includes("Dossier complet et relu"));
  assert.ok(preview.kpis.includes("Délai de validation · jours"));
  assert.ok(preview.governance.validation.includes("Validation humaine requise avant publication"));
});

test("uses a professional local placeholder when no photo exists", () => {
  const preview = buildOpportunityPreview({ ...snapshot, metadata: { ...snapshot.metadata, opportunityPresentation: {} } });
  assert.equal(opportunityHeroImage(preview), "/opportunity-housing.svg");
  assert.equal(preview.city, "Lyon");
});

test("enriches a housing request into a professional title and subtitle", () => {
  const enriched = enrichOpportunityPresentation({
    name: "Recherche de locataire pour T2 neuf avec jardin et terrasse",
    description: "Un logement agréable et récent.",
  });
  assert.equal(enriched.title, "T2 neuf avec jardin et terrasse");
  assert.equal(enriched.subtitle, "Recherche d'un locataire");
  assert.equal(enriched.category, "housing");
});

test("extracts opportunity highlights without changing source data", () => {
  const source = "Recherche de locataire pour T2 neuf avec jardin et terrasse";
  assert.deepEqual(extractOpportunityHighlights(source, "housing"), ["Jardin", "Terrasse", "Logement récent", "Location"]);
  assert.equal(source, "Recherche de locataire pour T2 neuf avec jardin et terrasse");
});

test("selects a local visual for every opportunity category", () => {
  assert.equal(inferOpportunityCategory("Je recrute un développeur"), "employment");
  assert.equal(inferOpportunityCategory("Je cherche un expert Python"), "consulting");
  assert.equal(inferOpportunityCategory("Je recherche un investisseur"), "investment");
  assert.equal(inferOpportunityCategory("Je recherche un partenaire"), "partnership");
  assert.equal(inferOpportunityCategory("Projet pour une association de bénévoles"), "association");
  assert.equal(inferOpportunityCategory("Assurance emprunteur pour prêt immobilier"), "insurance");
  assert.equal(inferOpportunityCategory("Je cherche un courtier immobilier"), "professional_services");
  assert.equal(inferOpportunityCategory("Besoin encore imprécis"), "generic");
  for (const visual of Object.values(OPPORTUNITY_CATEGORY_VISUALS)) assert.match(visual, /^\/opportunity-.+\.svg$/);
});

test("defines a dedicated presentation schema for every category", () => {
  assert.deepEqual(Object.keys(OPPORTUNITY_PRESENTATION_SCHEMAS), ["housing", "employment", "consulting", "professional_services", "insurance", "investment", "partnership", "association", "generic"]);
  assert.deepEqual(OPPORTUNITY_PRESENTATION_SCHEMAS.housing.map((item) => item.label), ["Surface", "Loyer", "Charges", "Pièces"]);
  assert.deepEqual(OPPORTUNITY_PRESENTATION_SCHEMAS.employment.map((item) => item.label), ["Poste", "Compétences", "Expérience", "Disponibilité", "Budget", "Modalité d'intervention"]);
  assert.deepEqual(OPPORTUNITY_PRESENTATION_SCHEMAS.consulting.map((item) => item.label), ["Mission", "Compétences", "Expérience", "Disponibilité", "Budget", "Modalité d'intervention"]);
});

test("renders housing metrics only for housing opportunities", () => {
  assert.deepEqual(buildOpportunityCategoryMetrics("housing", { surface: "67 m²", rent: "1 180 €", charges: "80 €", rooms: "3 pièces" }, ""), [
    { label: "Surface", value: "67 m²" }, { label: "Loyer", value: "1 180 €" }, { label: "Charges", value: "80 €" }, { label: "Pièces", value: "3 pièces" },
  ]);
});

test("renders employment metrics without housing fields", () => {
  const metrics = buildOpportunityCategoryMetrics("employment", { jobTitle: "Développeur TypeScript", skills: "TypeScript", experience: "3 ans", availability: "Septembre", budget: "55 k€", workMode: "Hybride" }, "");
  assert.deepEqual(metrics, [
    { label: "Poste", value: "Développeur TypeScript" }, { label: "Compétences", value: "TypeScript" }, { label: "Expérience", value: "3 ans" }, { label: "Disponibilité", value: "Septembre" }, { label: "Budget", value: "55 k€" }, { label: "Modalité d'intervention", value: "Hybride" },
  ]);
  assert.ok(metrics.every((metric) => !["Surface", "Loyer", "Charges", "Pièces"].includes(metric.label)));
});

test("builds an employment card without leaking housing presentation values", () => {
  const employmentSnapshot: TemplateSnapshot = {
    ...snapshot,
    relationTemplate: { ...snapshot.relationTemplate, name: "Développeur TypeScript", description: "Nous recrutons un développeur TypeScript en CDI à Lyon." },
    metadata: {
      ...snapshot.metadata,
      generation: { inputDescription: "Nous recrutons un développeur TypeScript en CDI à Lyon, avec télétravail hybride.", provider: "mock" },
      opportunityPresentation: { category: "employment", jobTitle: "Développeur TypeScript", contractType: "CDI", location: "Lyon", surface: "67 m²", rent: "1 180 €" },
    },
  };
  const preview = buildOpportunityPreview(employmentSnapshot);
  assert.equal(preview.category, "employment");
  assert.deepEqual(preview.keyMetrics.map((metric) => metric.label), ["Poste", "Compétences", "Expérience", "Disponibilité", "Budget", "Modalité d'intervention"]);
  assert.ok(preview.keyMetrics.every((metric) => !["Surface", "Loyer", "Charges", "Pièces"].includes(metric.label)));
  assert.equal(preview.keyMetrics.find((metric) => metric.label === "Expérience")?.value, "À préciser");
});

test("renders investment, partnership and association schemas", () => {
  assert.deepEqual(buildOpportunityCategoryMetrics("investment", { sector: "Santé", fundingStage: "Seed", targetAmount: "2 M€" }, ""), [
    { label: "Secteur", value: "Santé" }, { label: "Stade de financement", value: "Seed" }, { label: "Montant recherché", value: "2 M€" },
  ]);
  assert.deepEqual(buildOpportunityCategoryMetrics("partnership", { activity: "Formation", collaborationType: "Co-développement" }, ""), [
    { label: "Activité", value: "Formation" }, { label: "Type de collaboration", value: "Co-développement" },
  ]);
  assert.deepEqual(buildOpportunityCategoryMetrics("association", { mission: "Insertion professionnelle", volunteerNeeds: "Mentorat" }, ""), [
    { label: "Mission", value: "Insertion professionnelle" }, { label: "Besoins bénévoles", value: "Mentorat" },
  ]);
});

test("displays À préciser for missing category information", () => {
  for (const category of Object.keys(OPPORTUNITY_PRESENTATION_SCHEMAS) as Array<keyof typeof OPPORTUNITY_PRESENTATION_SCHEMAS>) {
    assert.ok(buildOpportunityCategoryMetrics(category, {}, "").every((metric) => metric.value === "À préciser"));
  }
});

test("derives publication readiness from presentation completeness only", () => {
  assert.equal(opportunityReadiness({ title: "T2", description: "", photos: [], attachments: [], verifiedLinks: [] }), "Brouillon");
  assert.equal(opportunityReadiness({ title: "T2", description: "Avec jardin", photos: ["photo.jpg"], attachments: [], verifiedLinks: [] }), "Presque prêt");
  assert.equal(opportunityReadiness({ title: "T2", description: "Avec jardin", photos: ["photo.jpg"], attachments: ["dpe.pdf"], verifiedLinks: ["https://example.test"] }), "Prêt à publier");
});

test("provides richer public empty states", () => {
  assert.equal(OPPORTUNITY_EMPTY_STATES.attachments, "Aucun document partagé pour le moment.");
  assert.equal(OPPORTUNITY_EMPTY_STATES.verifiedLinks, "Aucun lien vérifié ajouté.");
});

test("uses business wording for review and publication actions", () => {
  assert.equal(OPPORTUNITY_BUSINESS_WORDING.validationCriteria, "Objectifs de la recherche");
  assert.equal(OPPORTUNITY_BUSINESS_WORDING.publish, "Publier l'annonce");
});

test("keeps older generated snapshots compatible", () => {
  const legacy = buildOpportunityPreview({ ...snapshot, metadata: { snapshotVersion: 2, generation: snapshot.metadata.generation } });
  assert.equal(legacy.title, snapshot.relationTemplate.name);
  assert.equal(legacy.status, "DRAFT");
  assert.equal(legacy.attachments.length, 0);
  assert.equal(opportunityHeroImage(legacy), "/opportunity-housing.svg");
});

test("creates the automatic navigation URL after draft creation", () => {
  assert.equal(draftPreviewHref("template-123", "studio"), "/templates/template-123?created=1&assistant=studio");
  assert.equal(draftPreviewHref("template-123", "experience"), "/templates/template-123?created=1&assistant=experience");
});

test("provides edit and assistant return destinations", () => {
  assert.equal(opportunityEditHref(), "#opportunity-editor");
  assert.equal(assistantReturnHref("studio"), "/templates#ai-assistant");
  assert.equal(assistantReturnHref("experience"), "/experience");
});

test("infers opportunity types without changing generation workflows", () => {
  assert.equal(inferOpportunityType("Je recrute un développeur"), "Emploi et recrutement");
  assert.equal(inferOpportunityType("Je cherche un expert Python"), "Conseil et expertise");
  assert.equal(inferOpportunityType("Je recherche un investisseur"), "Investissement");
  assert.equal(inferOpportunityType("Je recherche un partenaire"), "Partenariat");
});

test("preserves domain-specific fields through generation, validation, publication and archive", () => {
  const scenarios: Array<{
    source: string;
    category: OpportunityCategory;
    requiredLabels: string[];
    forbiddenLabels: string[];
  }> = [
    { source: "Je cherche un appartement de 60 m² avec un loyer de 1200 €", category: "housing", requiredLabels: ["Surface", "Loyer", "Charges", "Pièces"], forbiddenLabels: ["Mission", "Compétences"] },
    { source: "Nous recrutons un candidat développeur backend en CDI", category: "employment", requiredLabels: ["Poste", "Compétences", "Expérience", "Disponibilité", "Budget", "Modalité d'intervention"], forbiddenLabels: ["Surface", "Loyer"] },
    { source: "Je cherche un expert Python freelance pour une mission", category: "consulting", requiredLabels: ["Mission", "Compétences", "Expérience", "Disponibilité", "Budget", "Modalité d'intervention"], forbiddenLabels: ["Surface", "Loyer", "Charges", "Pièces"] },
    { source: "Je cherche un courtier immobilier", category: "professional_services", requiredLabels: ["Service recherché", "Expertise", "Zone d'intervention", "Disponibilité", "Budget"], forbiddenLabels: ["Surface", "Loyer", "Charges", "Pièces"] },
    { source: "Assurance emprunteur pour prêt immobilier", category: "insurance", requiredLabels: ["Contrat recherché", "Besoin couvert", "Garanties souhaitées", "Échéance", "Budget"], forbiddenLabels: ["Surface", "Loyer", "Charges", "Pièces"] },
    { source: "Je recherche un investisseur pour une levée de fonds seed", category: "investment", requiredLabels: ["Secteur", "Stade de financement", "Montant recherché"], forbiddenLabels: ["Surface", "Poste"] },
    { source: "Je recherche un partenaire pour une alliance commerciale", category: "partnership", requiredLabels: ["Activité", "Type de collaboration"], forbiddenLabels: ["Surface", "Poste"] },
  ];

  for (const scenario of scenarios) {
    const generatedCategory = inferOpportunityCategory(scenario.source);
    assert.equal(generatedCategory, scenario.category);
    const persistedPresentation = buildPersistedOpportunityPresentation({
      generatedCategory,
      source: scenario.source,
    });
    assert.equal(persistedPresentation.category, scenario.category);

    const lifecycleSnapshot: TemplateSnapshot = {
      ...snapshot,
      relationTemplate: { ...snapshot.relationTemplate, name: scenario.source, description: scenario.source },
      metadata: {
        snapshotVersion: 2,
        lifecycle: "DRAFT",
        generation: { inputDescription: scenario.source },
        opportunityPresentation: persistedPresentation,
      },
    };
    const generated = buildOpportunityPreview(lifecycleSnapshot);
    const published = buildOpportunityPreview(
      { ...lifecycleSnapshot, metadata: { ...lifecycleSnapshot.metadata, lifecycle: "PUBLISHED" } },
      { isPublished: true, publishedAt: "2026-06-18T12:00:00.000Z" },
    );
    const archived = buildOpportunityPreview({
      ...lifecycleSnapshot,
      metadata: { ...lifecycleSnapshot.metadata, lifecycle: "ARCHIVED" },
    });

    for (const preview of [generated, published, archived]) {
      assert.equal(preview.category, scenario.category);
      assert.deepEqual(preview.keyMetrics.map((metric) => metric.label), scenario.requiredLabels);
      assert.ok(preview.keyMetrics.every((metric) => !scenario.forbiddenLabels.includes(metric.label)));
    }
  }
});

test("uses the AI-selected family instead of reclassifying the announcement text", () => {
  const persistedPresentation = buildPersistedOpportunityPresentation({
    presentation: { category: "housing", surface: "80 m²", rent: "1 500 €" },
    generatedCategory: "insurance",
    generatedCategoryConfidence: 0.94,
    source: "Assurance emprunteur pour prêt immobilier",
  });
  const selectedSnapshot: TemplateSnapshot = {
    ...snapshot,
    relationTemplate: { ...snapshot.relationTemplate, name: "Assurance emprunteur", description: "Assurance pour un prêt immobilier." },
    metadata: {
      snapshotVersion: 2,
      generation: { inputDescription: "Assurance emprunteur pour prêt immobilier" },
      opportunityPresentation: persistedPresentation,
    },
  };
  const preview = buildOpportunityPreview(selectedSnapshot);
  assert.equal(preview.category, "insurance");
  assert.equal(preview.opportunityType, "Assurance et services financiers");
  assert.ok(preview.keyMetrics.every((metric) => !["Surface", "Loyer", "Charges", "Pièces"].includes(metric.label)));
});

test("falls back to the generic family instead of housing for an uncertain opportunity", () => {
  const persistedPresentation = buildPersistedOpportunityPresentation({
    generatedCategory: "generic",
    generatedCategoryConfidence: 0.35,
    source: "Je souhaite explorer une possibilité autour d'un projet",
  });
  const uncertainSnapshot: TemplateSnapshot = {
    ...snapshot,
    relationTemplate: { ...snapshot.relationTemplate, name: "Projet à préciser", description: "Besoin encore imprécis." },
    metadata: {
      snapshotVersion: 2,
      generation: { inputDescription: "Je souhaite explorer une possibilité autour d'un projet" },
      opportunityPresentation: persistedPresentation,
    },
  };
  const preview = buildOpportunityPreview(uncertainSnapshot);
  assert.equal(preview.category, "generic");
  assert.deepEqual(preview.keyMetrics.map((metric) => metric.label), ["Objectif", "Besoin", "Modalités"]);
  assert.ok(preview.keyMetrics.every((metric) => !["Surface", "Loyer", "Charges", "Pièces"].includes(metric.label)));
});
