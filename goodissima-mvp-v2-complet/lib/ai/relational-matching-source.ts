import type { AIMatchingProfile } from "./matching.ts";
import { extractMatchingProfile } from "./matching.ts";
import { describeSimpleFieldRule } from "../simple-field-rules.ts";

export type RelationalMatchingSource =
  | {
      sourceType: "GLINK";
      sourceId: string;
      ownerId: string;
      title: string;
      description?: string | null;
      fields: Array<{ label: string; type: string; options?: unknown; validationRules?: unknown }>;
    }
  | {
      sourceType: "RELATION_CASE";
      sourceId: string;
      relationCaseId: string;
      gLinkId: string;
      ownerId: string;
      title: string;
      templateKey?: string | null;
      templateName?: string | null;
      messages: string[];
      documents: string[];
      aiInstructions?: string | null;
    };

function fieldText(field: Extract<RelationalMatchingSource, { sourceType: "GLINK" }>["fields"][number]) {
  const options = Array.isArray(field.options)
    ? field.options.flatMap((option) => {
        if (typeof option === "string") return option;
        if (!option || typeof option !== "object" || Array.isArray(option)) return [];
        const label = (option as Record<string, unknown>).label;
        return typeof label === "string" ? label : [];
      })
    : [];
  const rule = describeSimpleFieldRule({ label: field.label, validationRules: field.validationRules });
  return [field.label, field.type, ...options, rule].filter(Boolean).join(" ");
}

export function matchingProfileFromSource(source: RelationalMatchingSource): AIMatchingProfile {
  if (source.sourceType === "RELATION_CASE") {
    return extractMatchingProfile({
      templateKey: source.templateKey,
      templateName: source.templateName,
      title: source.title,
      messages: source.messages,
      documents: source.documents,
      aiInstructions: source.aiInstructions,
    });
  }
  const content = [source.title, source.description, ...source.fields.map(fieldText)].filter(Boolean).join(" ");
  const profile = extractMatchingProfile({
    title: content,
    messages: [],
    documents: [],
  });
  const normalized = content.toLocaleLowerCase("fr");
  const domains: Array<[string, string[]]> = [
    ["logement", ["appartement", "logement", "garage", "stationnement", "loyer", "locataire"]],
    ["emploi", ["emploi", "candidature", "recrutement", "freelance", "prestataire"]],
    ["services", ["ménage", "jardin", "baby-sitter", "pet-sitter", "artisan", "travaux"]],
    ["vehicule", ["voiture", "véhicule", "kilométrage"]],
    ["documents", ["document", "pièce jointe", "administratif", "dossier"]],
    ["relation", ["relation", "mise en contact", "partenaire", "recommandation", "conversation"]],
  ];
  const domain = domains.find(([, words]) => words.some((word) => normalized.includes(word)))?.[0] ?? "general";
  const keywords = normalized
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 5 && !["complet", "email", "texte", "champ", "message", "nombre", "optionnel", "obligatoire"].includes(word))
    .slice(0, 12);
  return {
    ...profile,
    categories: Array.from(new Set([...profile.categories, domain])),
    interests: Array.from(new Set([...profile.interests, ...keywords])),
    relationType: domain,
  };
}

export function hasUsefulGLinkMatchingCriteria(source: Extract<RelationalMatchingSource, { sourceType: "GLINK" }>) {
  const content = [source.title, source.description, ...source.fields.map((field) => field.label)].filter(Boolean).join(" ").trim();
  return content.length >= 20 && source.fields.length >= 2;
}

export type StoredGLinkMatchingAnalysis = {
  sourceType: "GLINK";
  sourceId: string;
  matchCount: number;
  matches: Array<{
    relationId: string;
    pseudonym: string;
    explanation: {
      compatibleElements: string[];
      semanticSignals?: string[];
      clarificationsNeeded: string[];
      warnings: string[];
    };
  }>;
};

export function serializeGLinkMatchingAnalysis(value: StoredGLinkMatchingAnalysis) {
  const compact: StoredGLinkMatchingAnalysis = {
    ...value,
    matches: value.matches.slice(0, 8).map((match) => ({
      ...match,
      pseudonym: match.pseudonym.slice(0, 120),
      explanation: {
        compatibleElements: match.explanation.compatibleElements.slice(0, 4).map((item) => item.slice(0, 180)),
        semanticSignals: match.explanation.semanticSignals?.slice(0, 3).map((item) => item.slice(0, 180)),
        clarificationsNeeded: match.explanation.clarificationsNeeded.slice(0, 3).map((item) => item.slice(0, 180)),
        warnings: match.explanation.warnings.slice(0, 3).map((item) => item.slice(0, 180)),
      },
    })),
  };
  let serialized = JSON.stringify(compact);
  while (serialized.length > 4000 && compact.matches.length > 1) {
    compact.matches.pop();
    serialized = JSON.stringify(compact);
  }
  compact.matchCount = value.matchCount;
  return JSON.stringify(compact);
}

export function parseGLinkMatchingAnalysis(value: string | null | undefined): StoredGLinkMatchingAnalysis | null {
  if (!value?.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(value) as StoredGLinkMatchingAnalysis;
    return parsed.sourceType === "GLINK" && typeof parsed.sourceId === "string" && Array.isArray(parsed.matches) ? parsed : null;
  } catch {
    return null;
  }
}
