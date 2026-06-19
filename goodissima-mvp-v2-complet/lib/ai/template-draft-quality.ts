export type TemplateDraftQualitySeverity = "critical" | "warning";

export type TemplateDraftQualityIssue = {
  code: string;
  severity: TemplateDraftQualitySeverity;
  message: string;
  path?: string;
};

export type TemplateDraftQualityResult = {
  valid: boolean;
  errors: TemplateDraftQualityIssue[];
  warnings: TemplateDraftQualityIssue[];
};

export type TemplateDraftProvenance = {
  provider?: unknown;
  model?: unknown;
  promptVersion?: unknown;
  language?: unknown;
  generatedAt?: unknown;
};

type RecordValue = Record<string, unknown>;

const frenchMarkers = new Set([
  "acteur", "acteurs", "adresse", "attendu", "besoin", "cadrage", "collecte", "complet", "décision",
  "délai", "demande", "description", "document", "documents", "étape", "étapes", "informations", "jour",
  "jours", "nom", "objectif", "parcours", "participant", "pièce", "responsable", "suivi", "taux", "validation",
]);
const englishMarkers = new Set([
  "action", "actor", "actors", "approval", "deadline", "document", "documents", "expected", "full", "name",
  "owner", "request", "requests", "review", "stage", "stages", "target", "workflow",
]);

function asRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
}

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function words(value: string) {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFC")
    .split(/[^a-zàâçéèêëîïôûùüÿñæœ]+/i)
    .filter(Boolean);
}

function labelsAreFrench(draft: RecordValue) {
  const labels = [
    draft.name,
    ...asList(draft.actors).flatMap((item) => {
      const row = asRecord(item);
      return [row.name, row.role];
    }),
    ...asList(draft.stages).flatMap((item) => {
      const row = asRecord(item);
      return [row.name, row.objective, row.expectedAction];
    }),
    ...asList(draft.documents).map((item) => asRecord(item).name),
    ...asList(draft.relationalRequests).flatMap((item) => {
      const row = asRecord(item);
      return [row.title, row.description];
    }),
    ...asList(draft.kpis).flatMap((item) => {
      const row = asRecord(item);
      return [row.name, row.description, row.unit];
    }),
    ...asList(draft.fields).map((item) => asRecord(item).label),
  ].filter(hasText) as string[];

  const tokens = labels.flatMap(words);
  const frenchScore = tokens.filter((token) => frenchMarkers.has(token)).length;
  const englishScore = tokens.filter((token) => englishMarkers.has(token)).length;
  const hasFrenchCharacters = labels.some((label) => /[àâçéèêëîïôûùüÿœæ]/i.test(label));

  return labels.length > 0 && (hasFrenchCharacters || frenchScore > 0) && frenchScore >= englishScore;
}

function hasProvenance(provenance: TemplateDraftProvenance | null | undefined) {
  if (!provenance) return false;
  return (
    hasText(provenance.provider) &&
    hasText(provenance.model) &&
    hasText(provenance.promptVersion) &&
    provenance.language === "fr" &&
    hasText(provenance.generatedAt) &&
    !Number.isNaN(Date.parse(String(provenance.generatedAt)))
  );
}

export function validateTemplateDraftQuality(input: {
  draft: unknown;
  provenance?: TemplateDraftProvenance | null;
  maxRecommendedStages?: number;
  requireUnpublished?: boolean;
  requireProvenance?: boolean;
}): TemplateDraftQualityResult {
  const draft = asRecord(input.draft);
  const actors = asList(draft.actors);
  const stages = asList(draft.stages);
  const documents = asList(draft.documents);
  const relationalRequests = asList(draft.relationalRequests);
  const kpis = asList(draft.kpis);
  const errors: TemplateDraftQualityIssue[] = [];
  const warnings: TemplateDraftQualityIssue[] = [];

  if (actors.length === 0) errors.push({ code: "MISSING_ACTOR", severity: "critical", message: "Le brouillon doit contenir au moins un acteur.", path: "actors" });
  if (stages.length === 0) errors.push({ code: "MISSING_STAGE", severity: "critical", message: "Le brouillon doit contenir au moins une étape.", path: "stages" });
  if (documents.length === 0 && relationalRequests.length === 0) {
    errors.push({ code: "MISSING_RELATIONAL_INPUT", severity: "critical", message: "Le brouillon doit contenir au moins une demande relationnelle ou un document.", path: "relationalRequests" });
  }
  if (kpis.length === 0) errors.push({ code: "MISSING_KPI", severity: "critical", message: "Le brouillon doit contenir au moins un KPI.", path: "kpis" });
  if (!labelsAreFrench(draft)) errors.push({ code: "NON_FRENCH_LABELS", severity: "critical", message: "Les libellés du brouillon doivent être rédigés en français." });
  if (input.requireUnpublished !== false && (draft.status === "PUBLISHED" || draft.isPublished === true)) {
    errors.push({ code: "PUBLISHED_DRAFT", severity: "critical", message: "Un brouillon généré par IA ne peut pas être publié.", path: "status" });
  }
  if (input.requireProvenance !== false && !hasProvenance(input.provenance)) {
    errors.push({ code: "MISSING_PROVENANCE", severity: "critical", message: "Les métadonnées de provenance IA sont absentes ou incomplètes.", path: "provenance" });
  }

  const maxRecommendedStages = input.maxRecommendedStages ?? 8;
  if (stages.length > maxRecommendedStages) {
    warnings.push({ code: "TOO_MANY_STAGES", severity: "warning", message: `Le brouillon contient ${stages.length} étapes; ${maxRecommendedStages} au maximum sont recommandées.`, path: "stages" });
  }

  stages.forEach((item, index) => {
    const stage = asRecord(item);
    if (!hasText(stage.deadline)) warnings.push({ code: "MISSING_DEADLINE", severity: "warning", message: `L'étape ${index + 1} ne précise aucun délai.`, path: `stages.${index}.deadline` });
    if (!hasText(stage.responsibleActor)) warnings.push({ code: "MISSING_RESPONSIBLE_ACTOR", severity: "warning", message: `L'étape ${index + 1} n'a pas d'acteur responsable.`, path: `stages.${index}.responsibleActor` });
    if (!hasText(stage.expectedAction)) warnings.push({ code: "MISSING_EXPECTED_ACTION", severity: "warning", message: `L'étape ${index + 1} ne précise aucune action attendue.`, path: `stages.${index}.expectedAction` });
  });

  relationalRequests.forEach((item, index) => {
    const request = asRecord(item);
    if (!hasText(request.targetActor)) warnings.push({ code: "MISSING_TARGET_ACTOR", severity: "warning", message: `La demande relationnelle ${index + 1} ne cible aucun acteur.`, path: `relationalRequests.${index}.targetActor` });
    if (!hasText(request.deadline)) warnings.push({ code: "MISSING_DEADLINE", severity: "warning", message: `La demande relationnelle ${index + 1} ne précise aucun délai.`, path: `relationalRequests.${index}.deadline` });
  });

  return { valid: errors.length === 0, errors, warnings };
}
