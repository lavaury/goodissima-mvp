import type { AICostEvent, AIValueEstimationInput } from "./cost-observability";

export type ValueAnalyticsPeriod = "30d" | "90d" | "12m";
export type TemplateValueSort = "generated" | "validated" | "validationRate" | "estimatedTimeSaved" | "totalCost";

export type TemplateGenerationValueRecord = {
  id: string;
  templateId: string | null;
  templateName: string;
  createdAt: Date;
  validatedAt: Date | null;
  costEur: number;
};

export type TemplateOptimizationValueRecord = {
  id: string;
  templateId: string;
  templateName: string;
  createdAt: Date;
  approvedAt: Date | null;
  draftVersionCreatedAt: Date | null;
  costEur: number;
};

export type TemplateCriticValueRecord = {
  id: string;
  templateId: string;
  templateName: string;
  createdAt: Date;
  costEur: number;
};

export type AIValueAnalyticsInput = {
  events: AICostEvent[];
  generations: TemplateGenerationValueRecord[];
  optimizations: TemplateOptimizationValueRecord[];
  criticReports: TemplateCriticValueRecord[];
};

export type TemplateValueRow = {
  key: string;
  templateName: string;
  templatesGenerated: number;
  templatesValidated: number;
  validationRate: number | null;
  optimizationProposals: number;
  optimizationApprovals: number;
  optimizedVersionsCreated: number;
  estimatedMinutesSaved: number;
  estimatedHoursSaved: number;
  totalCostEur: number;
  costPerValidatedTemplateEur: number | null;
};

export type FeatureValueRow = {
  feature: string;
  label: string;
  calls: number;
  costEur: number;
  templatesInfluenced: number;
  estimatedMinutesSaved: number;
  estimatedHoursSaved: number;
  successfulOutcomes: number;
  costPerSuccessfulOutcomeEur: number | null;
};

export type ValidationTrendPoint = {
  key: string;
  label: string;
  generated: number;
  validated: number;
  validationRate: number | null;
  optimizationProposals: number;
  optimizationApprovals: number;
  optimizationAdoptionRate: number | null;
};

const round = (value: number, digits = 6) => Number(value.toFixed(digits));
const ratio = (numerator: number, denominator: number) => denominator === 0 ? null : round(numerator / denominator, 4);
const unitCost = (cost: number, outcomes: number) => outcomes === 0 ? null : round(cost / outcomes);

function normalizeFeature(value: string | null) {
  if (!value) return "other";
  if (["matching_analysis", "semantic_matching_analysis", "semantic_embedding"].includes(value)) return "matching_analysis";
  if (value === "template_optimization_proposed" || value === "template_optimization_approved") return "template_optimizer";
  return value;
}

const featureLabels: Record<string, string> = {
  template_designer: "Template Designer",
  template_critic: "Template Critic",
  template_optimizer: "Template Optimizer",
  relation_summary: "Résumé",
  risk_signals: "Analyse des risques",
  matching_analysis: "Analyse de matching",
  timeline_intelligence: "Analyse chronologique",
  draft_assistant: "Assistant de rédaction",
  other: "Autres fonctionnalités",
};

function templateKey(templateId: string | null, templateName: string) {
  return templateId ?? `draft:${templateName.trim().toLocaleLowerCase("fr")}`;
}

export function buildValueByTemplate(input: AIValueAnalyticsInput, rules: AIValueEstimationInput, sort: TemplateValueSort = "validated") {
  const rows = new Map<string, TemplateValueRow>();
  const getRow = (key: string, name: string) => {
    const existing = rows.get(key);
    if (existing) return existing;
    const created: TemplateValueRow = {
      key, templateName: name, templatesGenerated: 0, templatesValidated: 0, validationRate: null,
      optimizationProposals: 0, optimizationApprovals: 0, optimizedVersionsCreated: 0,
      estimatedMinutesSaved: 0, estimatedHoursSaved: 0, totalCostEur: 0, costPerValidatedTemplateEur: null,
    };
    rows.set(key, created);
    return created;
  };

  for (const generation of input.generations) {
    const row = getRow(templateKey(generation.templateId, generation.templateName), generation.templateName);
    row.templatesGenerated += 1;
    row.templatesValidated += generation.validatedAt ? 1 : 0;
    row.estimatedMinutesSaved += rules.generatedTemplateMinutes;
    row.totalCostEur += generation.costEur;
  }
  for (const optimization of input.optimizations) {
    const row = getRow(optimization.templateId, optimization.templateName);
    row.optimizationProposals += 1;
    row.optimizationApprovals += optimization.approvedAt ? 1 : 0;
    row.optimizedVersionsCreated += optimization.draftVersionCreatedAt ? 1 : 0;
    row.estimatedMinutesSaved += rules.optimizationProposalMinutes;
    if (optimization.draftVersionCreatedAt) row.estimatedMinutesSaved += rules.optimizedTemplateVersionMinutes;
    row.totalCostEur += optimization.costEur;
  }
  for (const event of input.events) {
    if (!event.templateId || ["template_designer", "template_optimizer"].includes(normalizeFeature(event.featureName))) continue;
    const row = getRow(event.templateId, event.templateName ?? "Template sans nom");
    row.totalCostEur += event.estimatedCostEur ?? 0;
  }

  const sortValue = (row: TemplateValueRow) => {
    if (sort === "generated") return row.templatesGenerated;
    if (sort === "validated") return row.templatesValidated;
    if (sort === "validationRate") return row.validationRate ?? -1;
    if (sort === "estimatedTimeSaved") return row.estimatedMinutesSaved;
    return row.totalCostEur;
  };
  const result = Array.from(rows.values()).map((row) => ({
    ...row,
    validationRate: ratio(row.templatesValidated, row.templatesGenerated),
    estimatedHoursSaved: round(row.estimatedMinutesSaved / 60, 2),
    totalCostEur: round(row.totalCostEur),
    costPerValidatedTemplateEur: unitCost(row.totalCostEur, row.templatesValidated),
  }));
  return result.sort((a, b) => sortValue(b) - sortValue(a) || a.templateName.localeCompare(b.templateName, "fr"));
}

export function buildValueByFeature(input: AIValueAnalyticsInput, rules: AIValueEstimationInput) {
  const rows = new Map<string, FeatureValueRow>();
  const templates = new Map<string, Set<string>>();
  const getRow = (feature: string) => {
    const existing = rows.get(feature);
    if (existing) return existing;
    const created: FeatureValueRow = { feature, label: featureLabels[feature] ?? feature, calls: 0, costEur: 0, templatesInfluenced: 0, estimatedMinutesSaved: 0, estimatedHoursSaved: 0, successfulOutcomes: 0, costPerSuccessfulOutcomeEur: null };
    rows.set(feature, created);
    templates.set(feature, new Set());
    return created;
  };

  for (const event of input.events) {
    const feature = normalizeFeature(event.featureName);
    if (["template_designer", "template_critic", "template_optimizer"].includes(feature)) continue;
    const row = getRow(feature);
    row.calls += 1;
    row.costEur += event.estimatedCostEur ?? 0;
    if (event.status === "success") {
      row.successfulOutcomes += 1;
      row.estimatedMinutesSaved += rules.featureSuccessfulOutcomeMinutes?.[feature] ?? 0;
    }
    if (event.templateId) templates.get(feature)?.add(event.templateId);
  }

  const designer = getRow("template_designer");
  designer.calls = input.generations.length;
  designer.costEur = input.generations.reduce((sum, item) => sum + item.costEur, 0);
  designer.successfulOutcomes = input.generations.filter((item) => item.validatedAt).length;
  designer.estimatedMinutesSaved = input.generations.length * rules.generatedTemplateMinutes;
  input.generations.forEach((item) => templates.get("template_designer")?.add(templateKey(item.templateId, item.templateName)));

  const critic = getRow("template_critic");
  critic.calls = input.criticReports.length;
  critic.costEur = input.criticReports.reduce((sum, item) => sum + item.costEur, 0);
  critic.successfulOutcomes = input.criticReports.length;
  critic.estimatedMinutesSaved = input.criticReports.length * (rules.featureSuccessfulOutcomeMinutes?.template_critic ?? 0);
  input.criticReports.forEach((item) => templates.get("template_critic")?.add(item.templateId));

  const optimizer = getRow("template_optimizer");
  optimizer.calls = input.optimizations.length;
  optimizer.costEur = input.optimizations.reduce((sum, item) => sum + item.costEur, 0);
  optimizer.successfulOutcomes = input.optimizations.filter((item) => item.approvedAt).length;
  optimizer.estimatedMinutesSaved = input.optimizations.length * rules.optimizationProposalMinutes
    + input.optimizations.filter((item) => item.draftVersionCreatedAt).length * rules.optimizedTemplateVersionMinutes;
  input.optimizations.forEach((item) => templates.get("template_optimizer")?.add(item.templateId));

  return Array.from(rows.values()).map((row) => ({
    ...row,
    costEur: round(row.costEur),
    templatesInfluenced: templates.get(row.feature)?.size ?? 0,
    estimatedHoursSaved: round(row.estimatedMinutesSaved / 60, 2),
    costPerSuccessfulOutcomeEur: unitCost(row.costEur, row.successfulOutcomes),
  })).sort((a, b) => b.costEur - a.costEur || b.calls - a.calls || a.label.localeCompare(b.label, "fr"));
}

function periodBuckets(period: ValueAnalyticsPeriod, now: Date) {
  const monthly = period === "12m";
  const count = period === "30d" ? 30 : period === "90d" ? 90 : 12;
  return Array.from({ length: count }, (_, index) => {
    const date = monthly
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (count - 1 - index)));
    const key = monthly ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);
    return { key, label: monthly ? key : key.slice(5) };
  });
}

export function buildValidationTrends(input: AIValueAnalyticsInput, period: ValueAnalyticsPeriod, now = new Date()): ValidationTrendPoint[] {
  const keyFor = (date: Date) => period === "12m" ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);
  return periodBuckets(period, now).map((bucket) => {
    const generations = input.generations.filter((item) => keyFor(item.createdAt) === bucket.key);
    const optimizations = input.optimizations.filter((item) => keyFor(item.createdAt) === bucket.key);
    const validated = generations.filter((item) => item.validatedAt).length;
    const approvals = optimizations.filter((item) => item.approvedAt).length;
    return {
      ...bucket,
      generated: generations.length,
      validated,
      validationRate: ratio(validated, generations.length),
      optimizationProposals: optimizations.length,
      optimizationApprovals: approvals,
      optimizationAdoptionRate: ratio(approvals, optimizations.length),
    };
  });
}

export function buildEstimatedValueIndex(input: { validationRate: number | null; optimizationAdoptionRate: number | null; optimizedVersions: number; generatedTemplates: number }, weights: { validation: number; optimizationAdoption: number; optimizedConversion: number }) {
  const optimizedConversion = ratio(input.optimizedVersions, input.generatedTemplates) ?? 0;
  return round(100 * ((input.validationRate ?? 0) * weights.validation + (input.optimizationAdoptionRate ?? 0) * weights.optimizationAdoption + Math.min(optimizedConversion, 1) * weights.optimizedConversion), 1);
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvSection(rows: Array<Array<string | number | null>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function buildAdvancedValueCsv(input: { templates: TemplateValueRow[]; features: FeatureValueRow[]; trends: ValidationTrendPoint[]; roi: Record<string, string | number | null>; disclaimer: string }) {
  return [
    csvSection([["value_by_template"], ["template", "generated", "validated", "validation_rate", "optimization_proposals", "optimization_approvals", "optimized_versions", "estimated_minutes_saved", "estimated_hours_saved", "total_ai_cost_eur", "cost_per_validated_template_eur"], ...input.templates.map((row) => [row.templateName, row.templatesGenerated, row.templatesValidated, row.validationRate, row.optimizationProposals, row.optimizationApprovals, row.optimizedVersionsCreated, row.estimatedMinutesSaved, row.estimatedHoursSaved, row.totalCostEur, row.costPerValidatedTemplateEur])]),
    csvSection([["value_by_feature"], ["feature", "calls", "cost_eur", "templates_influenced", "estimated_minutes_saved", "estimated_hours_saved", "successful_outcomes", "cost_per_successful_outcome_eur"], ...input.features.map((row) => [row.label, row.calls, row.costEur, row.templatesInfluenced, row.estimatedMinutesSaved, row.estimatedHoursSaved, row.successfulOutcomes, row.costPerSuccessfulOutcomeEur])]),
    csvSection([["validation_trends"], ["period", "generated", "validated", "validation_rate", "optimization_proposals", "optimization_approvals", "optimization_adoption_rate"], ...input.trends.map((row) => [row.key, row.generated, row.validated, row.validationRate, row.optimizationProposals, row.optimizationApprovals, row.optimizationAdoptionRate])]),
    csvSection([["roi_indicators"], ["indicator", "value", "notice"], ...Object.entries(input.roi).map(([key, value]) => [key, value, input.disclaimer])]),
  ].join("\r\n\r\n");
}
