import {
  validateTemplateDraftQuality,
  type TemplateDraftQualityIssue,
  type TemplateDraftProvenance,
} from "./template-draft-quality";

export const templateCriticVersion = "template-critic-v1";

type RecordValue = Record<string, unknown>;

export type TemplateCriticSuggestion = {
  code: string;
  message: string;
  path?: string;
};

export type TemplateCriticReport = {
  criticVersion: string;
  criticalIssues: TemplateDraftQualityIssue[];
  warnings: TemplateDraftQualityIssue[];
  improvementSuggestions: TemplateCriticSuggestion[];
  overallQualityScore: number;
  analyzedAt: string;
};

function asRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
}

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function issue(code: string, message: string, path?: string): TemplateDraftQualityIssue {
  return { code, severity: "warning", message, path };
}

function measurableKpi(value: unknown) {
  const kpi = asRecord(value);
  if (!hasText(kpi.name) || !hasText(kpi.unit)) return false;
  const unit = String(kpi.unit).trim().toLocaleLowerCase("fr");
  return !["qualitatif", "observation", "à préciser", "a preciser", "n/a", "na"].includes(unit);
}

function deduplicateIssues(issues: TemplateDraftQualityIssue[]) {
  const seen = new Set<string>();
  return issues.filter((item) => {
    const key = `${item.code}:${item.path ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSuggestions(criticalIssues: TemplateDraftQualityIssue[], warnings: TemplateDraftQualityIssue[]) {
  const messages: Record<string, string> = {
    MISSING_ACTOR: "Ajouter au moins un acteur et décrire clairement son rôle.",
    MISSING_STAGE: "Structurer le parcours avec au moins une étape explicite.",
    MISSING_RELATIONAL_INPUT: "Ajouter une demande relationnelle ou un document attendu.",
    MISSING_KPI: "Définir au moins un KPI mesurable avec une unité.",
    NON_FRENCH_LABELS: "Réviser les libellés pour proposer une version française cohérente.",
    TOO_MANY_STAGES: "Regrouper les étapes proches afin de rendre le parcours plus lisible.",
    TOO_MANY_OPEN_ACTIONS: "Prioriser ou clôturer certaines actions avant d'en ajouter de nouvelles.",
    MISSING_DEADLINE: "Ajouter un délai indicatif, sans automatiser son exécution.",
    MISSING_RESPONSIBLE_ACTOR: "Associer un acteur responsable à chaque étape.",
    MISSING_EXPECTED_ACTION: "Décrire l'action humaine attendue pour chaque étape.",
    MISSING_TARGET_ACTOR: "Préciser l'acteur destinataire de chaque demande relationnelle.",
    NO_RELATIONAL_REQUESTS: "Ajouter au moins une demande relationnelle adressée à un acteur identifié.",
    NO_MEASURABLE_KPI: "Associer chaque objectif important à un indicateur et une unité mesurables.",
    MISSING_EXIT_CONDITION: "Définir une condition de sortie vérifiable pour chaque étape.",
  };
  const seen = new Set<string>();

  return [...criticalIssues, ...warnings].flatMap((item) => {
    const message = messages[item.code];
    if (!message || seen.has(item.code)) return [];
    seen.add(item.code);
    return [{ code: `IMPROVE_${item.code}`, message, path: item.path }];
  });
}

export function analyzeTemplateVersionQuality(input: {
  snapshot: unknown;
  provenance?: TemplateDraftProvenance | null;
  isPublished?: boolean;
  maxOpenActions?: number;
  analyzedAt?: string;
}): TemplateCriticReport {
  const snapshot = asRecord(input.snapshot);
  const relationTemplate = asRecord(snapshot.relationTemplate);
  const design = asRecord(snapshot.design);
  const stages = asList(design.stages);
  const relationalRequests = asList(design.relationalRequests);
  const kpis = asList(design.kpis);
  const draftShape = {
    name: relationTemplate.name,
    actors: asList(design.actors),
    stages,
    documents: asList(design.documents),
    relationalRequests,
    kpis,
    fields: asList(snapshot.fields),
    isPublished: input.isPublished === true,
  };
  const guard = validateTemplateDraftQuality({
    draft: draftShape,
    provenance: input.provenance,
    requireUnpublished: false,
    requireProvenance: false,
  });
  const warnings = [...guard.warnings];

  const openActions = relationalRequests.filter((value) => {
    const request = asRecord(value);
    return !hasText(request.status) || !["CLOSED", "COMPLETED", "CANCELLED"].includes(String(request.status).toUpperCase());
  });
  const maxOpenActions = input.maxOpenActions ?? 5;
  if (openActions.length > maxOpenActions) {
    warnings.push(issue("TOO_MANY_OPEN_ACTIONS", `La version contient ${openActions.length} actions ouvertes; ${maxOpenActions} au maximum sont recommandées.`, "design.relationalRequests"));
  }
  if (relationalRequests.length === 0) {
    warnings.push(issue("NO_RELATIONAL_REQUESTS", "La version ne contient aucune demande relationnelle.", "design.relationalRequests"));
  }
  if (!kpis.some(measurableKpi)) {
    warnings.push(issue("NO_MEASURABLE_KPI", "La version ne contient aucun KPI doté d'une unité mesurable.", "design.kpis"));
  }
  stages.forEach((value, index) => {
    const stage = asRecord(value);
    if (!hasText(stage.exitCondition)) {
      warnings.push(issue("MISSING_EXIT_CONDITION", `L'étape ${index + 1} ne définit aucune condition de sortie.`, `design.stages.${index}.exitCondition`));
    }
  });

  const criticalIssues = deduplicateIssues(guard.errors);
  const deduplicatedWarnings = deduplicateIssues(warnings);
  const score = Math.max(0, 100 - criticalIssues.length * 20 - deduplicatedWarnings.length * 5);

  return {
    criticVersion: templateCriticVersion,
    criticalIssues,
    warnings: deduplicatedWarnings,
    improvementSuggestions: buildSuggestions(criticalIssues, deduplicatedWarnings),
    overallQualityScore: score,
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
  };
}
