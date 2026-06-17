import { analyzeTemplateVersionQuality, type TemplateCriticReport } from "./template-critic";

export const templateOptimizerVersion = "template-optimizer-fr-v1";

type RecordValue = Record<string, unknown>;

export type TemplateOptimizationChange = {
  path: string;
  sourceIssueCode: string;
  explanation: string;
  before: unknown;
  after: unknown;
};

export type TemplateOptimizationProposal = {
  optimizerVersion: string;
  language: "fr";
  originalScore: number;
  projectedScore: number;
  changes: TemplateOptimizationChange[];
  unresolvedSuggestions: Array<{ code: string; message: string; path?: string }>;
  optimizedSnapshot: RecordValue;
  generatedAt: string;
};

function asRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMeasurableUnit(value: unknown) {
  const unit = hasText(value) ? String(value).trim().toLocaleLowerCase("fr") : "";
  return Boolean(unit) && !["qualitatif", "observation", "à préciser", "a preciser", "n/a", "na"].includes(unit);
}

function cloneSnapshot(snapshot: unknown): RecordValue {
  return JSON.parse(JSON.stringify(asRecord(snapshot))) as RecordValue;
}

function addChange(changes: TemplateOptimizationChange[], change: TemplateOptimizationChange) {
  changes.push(change);
}

export function generateTemplateOptimizationProposal(input: {
  snapshot: unknown;
  criticReport: TemplateCriticReport;
  generatedAt?: string;
}): TemplateOptimizationProposal {
  const optimizedSnapshot = cloneSnapshot(input.snapshot);
  const design = asRecord(optimizedSnapshot.design);
  optimizedSnapshot.design = design;
  const actors = asList(design.actors);
  const stages = asList(design.stages);
  const documents = asList(design.documents);
  const requests = asList(design.relationalRequests);
  const kpis = asList(design.kpis);
  design.actors = actors;
  design.stages = stages;
  design.documents = documents;
  design.relationalRequests = requests;
  design.kpis = kpis;
  const changes: TemplateOptimizationChange[] = [];
  const issueCodes = new Set([...input.criticReport.criticalIssues, ...input.criticReport.warnings].map((item) => item.code));

  if (issueCodes.has("MISSING_ACTOR") && actors.length === 0) {
    const actor = { name: "Responsable du parcours", role: "Pilote la relation et valide les décisions humaines" };
    actors.push(actor);
    addChange(changes, { path: "design.actors", sourceIssueCode: "MISSING_ACTOR", explanation: "Ajout proposé d'un rôle responsable pour rendre la gouvernance du parcours explicite.", before: [], after: actor });
  }
  const responsibleActor = asRecord(actors[0]).name;

  if (issueCodes.has("MISSING_STAGE") && stages.length === 0) {
    const stage = { name: "Validation humaine", objective: "Relire les éléments du parcours", expectedAction: "Valider ou demander des précisions", responsibleActor: hasText(responsibleActor) ? responsibleActor : "Responsable du parcours", deadline: "À définir lors de la validation humaine", exitCondition: "Une décision humaine documentée est enregistrée" };
    stages.push(stage);
    addChange(changes, { path: "design.stages", sourceIssueCode: "MISSING_STAGE", explanation: "Ajout proposé d'une étape minimale de validation humaine, sans automatisation.", before: [], after: stage });
  }

  stages.forEach((value, index) => {
    const stage = asRecord(value);
    stages[index] = stage;
    if (!hasText(stage.deadline)) {
      const after = "À définir lors de la validation humaine";
      addChange(changes, { path: `design.stages.${index}.deadline`, sourceIssueCode: "MISSING_DEADLINE", explanation: "Ajout proposé d'un délai indicatif à confirmer humainement.", before: stage.deadline ?? null, after });
      stage.deadline = after;
    }
    if (!hasText(stage.responsibleActor)) {
      const after = hasText(responsibleActor) ? responsibleActor : "Responsable du parcours";
      addChange(changes, { path: `design.stages.${index}.responsibleActor`, sourceIssueCode: "MISSING_RESPONSIBLE_ACTOR", explanation: "Association proposée d'un responsable explicite à l'étape.", before: stage.responsibleActor ?? null, after });
      stage.responsibleActor = after;
    }
    if (!hasText(stage.expectedAction)) {
      const after = "Réaliser l'action attendue puis documenter le résultat";
      addChange(changes, { path: `design.stages.${index}.expectedAction`, sourceIssueCode: "MISSING_EXPECTED_ACTION", explanation: "Ajout proposé d'une action attendue explicite et vérifiable.", before: stage.expectedAction ?? null, after });
      stage.expectedAction = after;
    }
    if (!hasText(stage.exitCondition)) {
      const after = "Le résultat de l'étape est relu et confirmé par le responsable";
      addChange(changes, { path: `design.stages.${index}.exitCondition`, sourceIssueCode: "MISSING_EXIT_CONDITION", explanation: "Ajout proposé d'une condition de sortie soumise à confirmation humaine.", before: stage.exitCondition ?? null, after });
      stage.exitCondition = after;
    }
  });

  if ((issueCodes.has("MISSING_RELATIONAL_INPUT") || issueCodes.has("NO_RELATIONAL_REQUESTS")) && requests.length === 0) {
    const request = { title: "Demande de validation", description: "Relire les informations et confirmer la suite à donner", stage: 1, targetActor: hasText(responsibleActor) ? responsibleActor : "Responsable du parcours", deadline: "À définir lors de la validation humaine", status: "PROPOSED" };
    requests.push(request);
    addChange(changes, { path: "design.relationalRequests", sourceIssueCode: issueCodes.has("NO_RELATIONAL_REQUESTS") ? "NO_RELATIONAL_REQUESTS" : "MISSING_RELATIONAL_INPUT", explanation: "Ajout proposé d'une demande relationnelle adressée à un acteur, sans exécution automatique.", before: [], after: request });
  }

  requests.forEach((value, index) => {
    const request = asRecord(value);
    requests[index] = request;
    if (!hasText(request.targetActor)) {
      const after = hasText(responsibleActor) ? responsibleActor : "Responsable du parcours";
      addChange(changes, { path: `design.relationalRequests.${index}.targetActor`, sourceIssueCode: "MISSING_TARGET_ACTOR", explanation: "Ajout proposé d'un destinataire explicite pour la demande.", before: request.targetActor ?? null, after });
      request.targetActor = after;
    }
    if (!hasText(request.deadline)) {
      const after = "À définir lors de la validation humaine";
      addChange(changes, { path: `design.relationalRequests.${index}.deadline`, sourceIssueCode: "MISSING_DEADLINE", explanation: "Ajout proposé d'un délai indicatif à confirmer avant utilisation.", before: request.deadline ?? null, after });
      request.deadline = after;
    }
  });

  if ((issueCodes.has("MISSING_KPI") || issueCodes.has("NO_MEASURABLE_KPI")) && !kpis.some((value) => hasMeasurableUnit(asRecord(value).unit))) {
    const kpi = { name: "Délai de traitement", description: "Temps entre l'ouverture du parcours et sa validation humaine", unit: "jours" };
    kpis.push(kpi);
    addChange(changes, { path: "design.kpis", sourceIssueCode: issueCodes.has("NO_MEASURABLE_KPI") ? "NO_MEASURABLE_KPI" : "MISSING_KPI", explanation: "Ajout proposé d'un indicateur mesurable avec une unité explicite.", before: [], after: kpi });
  }

  const projectedReport = analyzeTemplateVersionQuality({ snapshot: optimizedSnapshot, isPublished: false, analyzedAt: input.generatedAt });
  const resolvedCodes = new Set(changes.map((change) => change.sourceIssueCode));
  const unresolvedSuggestions = input.criticReport.improvementSuggestions.filter((suggestion) => {
    const sourceCode = suggestion.code.replace(/^IMPROVE_/, "");
    return !resolvedCodes.has(sourceCode);
  });

  return {
    optimizerVersion: templateOptimizerVersion,
    language: "fr",
    originalScore: input.criticReport.overallQualityScore,
    projectedScore: projectedReport.overallQualityScore,
    changes,
    unresolvedSuggestions,
    optimizedSnapshot,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
