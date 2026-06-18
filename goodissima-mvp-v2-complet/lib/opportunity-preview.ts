import type { TemplateSnapshot } from "@/lib/template-snapshots";
import { announcementPublicationState } from "./announcement-publication.ts";

export type OpportunityPreview = {
  title: string;
  subtitle: string;
  category: OpportunityCategory;
  summary: string;
  highlights: string[];
  opportunityType: string;
  propertyType: string;
  city: string;
  keyMetrics: OpportunityMetric[];
  publicationStatus: string;
  publishedAt: string | null;
  readiness: OpportunityReadiness;
  status: "DRAFT" | "PUBLISHED";
  trustIndicators: string[];
  actors: string[];
  stages: string[];
  kpis: string[];
  requiredDocuments: string[];
  validationCriteria: string[];
  photos: string[];
  attachments: string[];
  verifiedLinks: string[];
  governance: {
    validation: string[];
    provenance: string[];
    audit: string[];
  };
};

export type OpportunityCategory = "housing" | "employment" | "consulting" | "investment" | "partnership" | "association";
export type OpportunityReadiness = "Brouillon" | "Presque prêt" | "Prêt à publier";
export type OpportunityMetric = { label: string; value: string };

type OpportunityMetricDefinition = {
  label: string;
  presentationKeys: string[];
  infer?: (source: string) => string | null;
};

export type OpportunityPresentationSource = {
  name: string;
  description?: string | null;
  inputDescription?: string | null;
  presentation?: Record<string, unknown>;
};

export const OPPORTUNITY_EMPTY_STATES = {
  attachments: "Aucun document partagé pour le moment.",
  verifiedLinks: "Aucun lien vérifié ajouté.",
} as const;

export const OPPORTUNITY_CATEGORY_VISUALS: Record<OpportunityCategory, string> = {
  housing: "/opportunity-housing.svg",
  employment: "/opportunity-employment.svg",
  consulting: "/opportunity-employment.svg",
  investment: "/opportunity-investment.svg",
  partnership: "/opportunity-partnership.svg",
  association: "/opportunity-association.svg",
};

const MISSING_OPPORTUNITY_VALUE = "À préciser";

function captured(source: string, pattern: RegExp) {
  return source.match(pattern)?.[1]?.trim() || null;
}

export const OPPORTUNITY_PRESENTATION_SCHEMAS: Record<OpportunityCategory, OpportunityMetricDefinition[]> = {
  housing: [
    { label: "Surface", presentationKeys: ["surface", "area"], infer: (source) => captured(source, /(\d+(?:[,.]\d+)?\s*m(?:²|2))/i) },
    { label: "Loyer", presentationKeys: ["rent", "price"], infer: (source) => captured(source, /(?:loyer[^\d]{0,12})(\d[\d\s]*(?:[,.]\d+)?\s*€)/i) },
    { label: "Charges", presentationKeys: ["charges", "fees"], infer: (source) => captured(source, /(?:charges?[^\d]{0,12})(\d[\d\s]*(?:[,.]\d+)?\s*€)/i) },
    { label: "Pièces", presentationKeys: ["rooms", "roomCount"], infer: (source) => captured(source, /(\d+\s*(?:pièces?|chambres?))/i) },
  ],
  employment: [
    { label: "Poste", presentationKeys: ["jobTitle", "position", "role"], infer: (source) => captured(source, /(?:recrute|recherche)\s+(?:un|une)?\s*([^,.;]+?)(?:\s+(?:en|à|pour)\s+|[,.;]|$)/i) },
    { label: "Compétences", presentationKeys: ["skills", "competencies", "expertise"], infer: (source) => captured(source, /(?:compétences?|maîtrise|expertise)\s*(?:en|:)?\s*([^.;]+)/i) },
    { label: "Expérience", presentationKeys: ["experience", "experienceLevel"], infer: (source) => captured(source, /(\d+\s*(?:ans?|années?)\s+d['’]expérience)/i) },
    { label: "Disponibilité", presentationKeys: ["availability", "startDate"] },
    { label: "Budget", presentationKeys: ["budget", "salary", "compensation"], infer: (source) => captured(source, /(\d[\d\s]*(?:[,.]\d+)?\s*(?:k€|K€|€))/i) },
    { label: "Modalité d'intervention", presentationKeys: ["workMode", "remotePolicy", "contractType", "contract"], infer: (source) => captured(source, /\b(CDI|CDD|stage|alternance|intérim|télétravail(?:\s+(?:partiel|complet|hybride))?|hybride|sur site|remote)\b/i) },
  ],
  consulting: [
    { label: "Mission", presentationKeys: ["mission", "assignment", "jobTitle"], infer: (source) => captured(source, /(?:cherche|recherche)\s+(?:un|une)?\s*([^,.;]+)/i) },
    { label: "Compétences", presentationKeys: ["skills", "competencies", "expertise"], infer: (source) => captured(source, /\b(Python|TypeScript|JavaScript|Java|PHP|React|Django|data|IA|intelligence artificielle)\b/i) },
    { label: "Expérience", presentationKeys: ["experience", "experienceLevel"], infer: (source) => captured(source, /(\d+\s*(?:ans?|années?)\s+d['’]expérience)/i) },
    { label: "Disponibilité", presentationKeys: ["availability", "startDate"] },
    { label: "Budget", presentationKeys: ["budget", "dailyRate", "rate"], infer: (source) => captured(source, /(\d[\d\s]*(?:[,.]\d+)?\s*(?:€|k€|K€)(?:\s*\/\s*jour)?)/i) },
    { label: "Modalité d'intervention", presentationKeys: ["workMode", "deliveryMode", "contractType"], infer: (source) => captured(source, /\b(freelance|mission|forfait|régie|télétravail|hybride|sur site|remote)\b/i) },
  ],
  investment: [
    { label: "Secteur", presentationKeys: ["sector", "industry"] },
    { label: "Stade de financement", presentationKeys: ["fundingStage", "stage"], infer: (source) => captured(source, /\b(pré[- ]amorçage|amorçage|seed|série\s+[a-d]|croissance)\b/i) },
    { label: "Montant recherché", presentationKeys: ["targetAmount", "fundingTarget", "amount"], infer: (source) => captured(source, /(\d[\d\s]*(?:[,.]\d+)?\s*(?:k€|K€|M€|millions?\s+d['’]euros|€))/i) },
  ],
  partnership: [
    { label: "Activité", presentationKeys: ["activity", "businessActivity"] },
    { label: "Type de collaboration", presentationKeys: ["collaborationType", "partnershipType"] },
  ],
  association: [
    { label: "Mission", presentationKeys: ["mission", "cause"] },
    { label: "Besoins bénévoles", presentationKeys: ["volunteerNeeds", "volunteers", "needs"] },
  ],
};

export function isOpportunityCategory(value: string): value is OpportunityCategory {
  return Object.prototype.hasOwnProperty.call(OPPORTUNITY_PRESENTATION_SCHEMAS, value);
}

export const OPPORTUNITY_PREVIEW_TABS = [
  { id: "announcement", label: "Annonce" },
  { id: "journey", label: "Parcours" },
  { id: "governance", label: "Gouvernance" },
] as const;

export const OPPORTUNITY_BUSINESS_WORDING = {
  validationCriteria: "Objectifs de la recherche",
  publish: "Publier l'annonce",
} as const;

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function presentationText(presentation: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = text(presentation[key]);
    if (value) return value;
  }
  return fallback;
}

export function buildOpportunityCategoryMetrics(category: OpportunityCategory, presentation: Record<string, unknown>, source: string): OpportunityMetric[] {
  return OPPORTUNITY_PRESENTATION_SCHEMAS[category].map((definition) => ({
    label: definition.label,
    value: presentationText(presentation, definition.presentationKeys, definition.infer?.(source) ?? MISSING_OPPORTUNITY_VALUE),
  }));
}

function inferCity(source: string) {
  const city = ["Paris", "Lyon", "Lille", "Bordeaux", "Nantes", "Marseille", "Toulouse", "Rennes", "Strasbourg", "Nice"]
    .find((item) => source.toLocaleLowerCase("fr").includes(item.toLocaleLowerCase("fr")));
  return city ?? "Localisation à préciser";
}

function inferPropertyType(source: string, fallback: string) {
  const match = source.match(/\b(studio|appartement|maison|loft|bureau|local commercial|t[1-6])\b/i)?.[1];
  return match ? match.charAt(0).toLocaleUpperCase("fr") + match.slice(1) : fallback;
}

export function inferOpportunityType(input: string) {
  return {
    housing: "Immobilier et location",
    employment: "Emploi et recrutement",
    consulting: "Conseil et expertise",
    investment: "Investissement",
    partnership: "Partenariat",
    association: "Association",
  }[inferOpportunityCategory(input)];
}

export function inferOpportunityCategory(input: string): OpportunityCategory {
  const normalized = input.toLocaleLowerCase("fr");
  if (/association|bénévol|mécénat|collectif|cause/.test(normalized)) return "association";
  if (/investisseur|investissement|financement|levée de fonds/.test(normalized)) return "investment";
  if (/partenaire|partenariat|alliance|coopération/.test(normalized)) return "partnership";
  if (/appartement|logement|locataire|location|loyer|surface|maison|studio|immobilier/.test(normalized)) return "housing";
  if (/consult|conseil|expert(?:e)?|expertise|freelance|prestataire|mission|python/.test(normalized)) return "consulting";
  if (/recrut|emploi|poste|embauche|candidat|cdi|cdd/.test(normalized)) return "employment";
  return "partnership";
}

function smartTitle(source: string, fallback: string) {
  const cleaned = source
    .replace(/^je\s+(?:suis à la recherche|recherche|cherche)\s+(?:de|d['’])?\s*/i, "")
    .replace(/^recherche\s+(?:de|d['’])?\s*/i, "")
    .replace(/^(?:un|une)\s+(?:locataire|candidat|investisseur|partenaire|bénévole)\s+(?:pour|afin de)\s+/i, "")
    .replace(/^(?:locataire|candidat|investisseur|partenaire|bénévole)\s+pour\s+/i, "")
    .replace(/^de\s+(?:locataire|candidat|investisseur|partenaire|bénévole)\s+pour\s+/i, "")
    .trim();
  if (!cleaned || cleaned.length < 4) return fallback;
  return cleaned.charAt(0).toLocaleUpperCase("fr") + cleaned.slice(1);
}

function inferSubtitle(source: string, category: OpportunityCategory) {
  const normalized = source.toLocaleLowerCase("fr");
  if (/locataire/.test(normalized)) return "Recherche d'un locataire";
  if (/candidat|recrut|emploi|poste/.test(normalized)) return "Recherche d'un candidat";
  if (/consult|expert|freelance|prestataire|mission|python/.test(normalized)) return "Recherche d'un expert";
  if (/investisseur|financement/.test(normalized)) return "Recherche d'un investisseur";
  if (/partenaire|partenariat/.test(normalized)) return "Recherche d'un partenaire";
  if (/bénévol|association/.test(normalized)) return "Projet associatif";
  return { housing: "Opportunité immobilière", employment: "Opportunité professionnelle", consulting: "Mission de conseil", investment: "Opportunité d'investissement", partnership: "Opportunité de partenariat", association: "Opportunité associative" }[category];
}

const HIGHLIGHT_RULES: Array<[RegExp, string]> = [
  [/\bjardin\b/i, "Jardin"],
  [/\bterrasse\b/i, "Terrasse"],
  [/\bbalcon\b/i, "Balcon"],
  [/\bneuf|récent|rénové/i, "Logement récent"],
  [/\bmeublé/i, "Meublé"],
  [/\bparking|garage/i, "Stationnement"],
  [/\btélétravail|remote|à distance/i, "Télétravail"],
  [/\bcdi\b/i, "CDI"],
  [/\bimpact|responsable|durable/i, "Impact positif"],
];

export function extractOpportunityHighlights(source: string, category: OpportunityCategory) {
  const highlights = HIGHLIGHT_RULES.filter(([pattern]) => pattern.test(source)).map(([, label]) => label);
  const categoryHighlight = { housing: "Location", employment: "Recrutement", consulting: "Expertise", investment: "Investissement", partnership: "Partenariat", association: "Association" }[category];
  return Array.from(new Set([...highlights, categoryHighlight])).slice(0, 6);
}

export function opportunityReadiness(input: { title: string; description: string; photos: string[]; attachments: string[]; verifiedLinks: string[] }): OpportunityReadiness {
  const completed = [Boolean(input.title.trim()), Boolean(input.description.trim()), input.photos.length > 0, input.attachments.length > 0, input.verifiedLinks.length > 0].filter(Boolean).length;
  if (completed >= 5) return "Prêt à publier";
  if (completed >= 3) return "Presque prêt";
  return "Brouillon";
}

export function enrichOpportunityPresentation(source: OpportunityPresentationSource) {
  const presentation = source.presentation ?? {};
  const input = source.inputDescription?.trim() || source.description?.trim() || source.name;
  const context = [source.name, source.description, source.inputDescription].filter(Boolean).join(" ");
  const explicitCategory = text(presentation.category);
  const category = explicitCategory && isOpportunityCategory(explicitCategory) ? explicitCategory : inferOpportunityCategory(context);
  const photos = strings(presentation.photos);
  const attachments = strings(presentation.attachments);
  const verifiedLinks = strings(presentation.verifiedLinks);
  const title = presentationText(presentation, ["title"], smartTitle(source.name, source.name));
  const summary = presentationText(presentation, ["summary"], source.description?.trim() || input);
  return {
    title,
    subtitle: presentationText(presentation, ["subtitle"], inferSubtitle(context, category)),
    category,
    summary,
    highlights: strings(presentation.highlights).length ? strings(presentation.highlights) : extractOpportunityHighlights(context, category),
    keyMetrics: buildOpportunityCategoryMetrics(category, presentation, context),
    photos,
    attachments,
    verifiedLinks,
    readiness: opportunityReadiness({ title, description: summary, photos, attachments, verifiedLinks }),
  };
}

export function resolveOpportunityCategory(input: {
  explicitCategory?: unknown;
  generatedCategory?: unknown;
  source: string;
}): OpportunityCategory {
  const explicit = text(input.explicitCategory);
  if (explicit && isOpportunityCategory(explicit)) return explicit;
  const generated = text(input.generatedCategory);
  if (generated && isOpportunityCategory(generated)) return generated;
  return inferOpportunityCategory(input.source);
}

const OPPORTUNITY_PRESENTATION_TEXT_KEYS = [
  "title", "subtitle", "summary", "city", "location", "propertyType", "housingType", "type",
  "surface", "area", "rent", "price", "charges", "fees", "rooms", "roomCount",
  "jobTitle", "position", "role", "skills", "competencies", "expertise", "experience", "experienceLevel",
  "availability", "startDate", "budget", "salary", "compensation", "workMode", "remotePolicy",
  "contractType", "contract", "mission", "assignment", "dailyRate", "rate", "deliveryMode",
  "sector", "industry", "fundingStage", "stage", "targetAmount", "fundingTarget", "amount",
  "activity", "businessActivity", "collaborationType", "partnershipType", "cause",
  "volunteerNeeds", "volunteers", "needs",
] as const;

export function buildPersistedOpportunityPresentation(input: {
  presentation?: Record<string, unknown>;
  generatedCategory?: unknown;
  source: string;
}) {
  const presentation = input.presentation ?? {};
  const result: Record<string, string | string[]> = {
    category: resolveOpportunityCategory({
      explicitCategory: presentation.category,
      generatedCategory: input.generatedCategory,
      source: input.source,
    }),
  };

  for (const key of OPPORTUNITY_PRESENTATION_TEXT_KEYS) {
    const value = text(presentation[key]);
    if (value) result[key] = value;
  }
  for (const key of ["photos", "attachments", "verifiedLinks", "highlights"] as const) {
    const values = strings(presentation[key]).map((value) => value.trim()).filter(Boolean).slice(0, 10);
    if (values.length) result[key] = values;
  }

  return result;
}

export function buildOpportunityPreview(snapshot: TemplateSnapshot, publication?: { isPublished?: boolean; publishedAt?: string | null }): OpportunityPreview {
  const generation = snapshot.metadata.generation && typeof snapshot.metadata.generation === "object" && !Array.isArray(snapshot.metadata.generation)
    ? snapshot.metadata.generation as Record<string, unknown>
    : {};
  const presentation = snapshot.metadata.opportunityPresentation && typeof snapshot.metadata.opportunityPresentation === "object" && !Array.isArray(snapshot.metadata.opportunityPresentation)
    ? snapshot.metadata.opportunityPresentation as Record<string, unknown>
    : {};
  const actors = records(snapshot.design?.actors).map((item) => [text(item.name), text(item.role)].filter(Boolean).join(" : ")).filter(Boolean);
  const documents = records(snapshot.design?.documents).filter((item) => item.required === true).map((item) => text(item.name)).filter((item): item is string => Boolean(item));
  const stages = records(snapshot.design?.stages).map((item) => text(item.exitCondition) ?? text(item.objective)).filter((item): item is string => Boolean(item));
  const kpis = records(snapshot.design?.kpis).map((item) => {
    const name = text(item.name);
    const unit = text(item.unit);
    return name ? `${name}${unit ? ` · ${unit}` : ""}` : null;
  }).filter((item): item is string => Boolean(item));
  const sourceDescription = text(generation.inputDescription) ?? snapshot.relationTemplate.description ?? snapshot.relationTemplate.name;
  const provider = text(generation.provider);
  const model = text(generation.model);
  const promptVersion = text(generation.promptVersion);
  const photos = strings(presentation.photos);
  const enriched = enrichOpportunityPresentation({ name: snapshot.relationTemplate.name, description: snapshot.relationTemplate.description, inputDescription: sourceDescription, presentation });
  const publicationState = announcementPublicationState(publication);

  return {
    title: enriched.title,
    subtitle: enriched.subtitle,
    category: enriched.category,
    summary: enriched.summary,
    highlights: enriched.highlights,
    opportunityType: inferOpportunityType(sourceDescription),
    propertyType: enriched.category === "housing"
      ? presentationText(presentation, ["propertyType", "housingType", "type"], inferPropertyType(sourceDescription, inferOpportunityType(sourceDescription)))
      : inferOpportunityType(sourceDescription),
    city: presentationText(presentation, ["city", "location"], inferCity(sourceDescription)),
    keyMetrics: buildOpportunityCategoryMetrics(enriched.category, presentation, sourceDescription),
    publicationStatus: publicationState.publicationStatus,
    publishedAt: publicationState.publishedAt,
    readiness: enriched.readiness,
    status: publicationState.status,
    trustIndicators: ["Validation humaine enregistrée", "Provenance conservée", publicationState.status === "PUBLISHED" ? "Publication enregistrée" : "Non publiée"],
    actors,
    stages,
    kpis,
    requiredDocuments: documents,
    validationCriteria: [...stages, ...kpis],
    photos,
    attachments: strings(presentation.attachments),
    verifiedLinks: strings(presentation.verifiedLinks),
    governance: {
      validation: publicationState.status === "PUBLISHED"
        ? ["Publication validée humainement", "Aucune décision automatique", "Annonce publiée"]
        : ["Validation humaine requise avant publication", "Aucune décision automatique", "Brouillon non publié"],
      provenance: [provider ? `Fournisseur : ${provider}` : "Fournisseur enregistré dans l'audit", model ? `Modèle : ${model}` : null, promptVersion ? `Version du prompt : ${promptVersion}` : null].filter((item): item is string => Boolean(item)),
      audit: [`Snapshot v${snapshot.metadata.snapshotVersion}`, "Historique de version conservé", "Publication soumise à une action humaine"],
    },
  };
}

export function opportunityHeroImage(preview: Pick<OpportunityPreview, "photos" | "category">) {
  return preview.photos[0] || OPPORTUNITY_CATEGORY_VISUALS[preview.category];
}

export function draftPreviewHref(templateId: string, assistant: "studio" | "experience") {
  return `/templates/${templateId}?created=1&assistant=${assistant}`;
}

export function assistantReturnHref(assistant: string | undefined) {
  return assistant === "experience" ? "/experience" : "/templates#ai-assistant";
}

export function opportunityEditHref(templateId?: string) {
  return templateId ? `/templates/${templateId}?advanced=1#opportunity-editor` : "#opportunity-editor";
}
