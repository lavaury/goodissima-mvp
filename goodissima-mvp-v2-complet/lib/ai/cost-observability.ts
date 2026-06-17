export type AICostEvent = {
  id: string;
  provider: string;
  model: string | null;
  featureName: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  estimatedCostEur: number | null;
  status: string;
  userId: string | null;
  userEmail: string | null;
  organizationId: string | null;
  organizationName: string | null;
  templateId: string | null;
  templateName: string | null;
  createdAt: Date;
};

export type AICostGroup = {
  key: string;
  label: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costEur: number;
};

export type AIValueActivity = {
  templatesGenerated: number;
  templatesValidated: number;
  optimizationProposalsGenerated: number;
  optimizationProposalsApproved: number;
  optimizedTemplateVersionsCreated: number;
};

export type AIValueEstimationInput = {
  version: string;
  generatedTemplateMinutes: number;
  optimizationProposalMinutes: number;
  optimizedTemplateVersionMinutes: number;
  featureSuccessfulOutcomeMinutes?: Partial<Record<string, number>>;
  disclaimerFr: string;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function roundCost(value: number) {
  return Number(value.toFixed(6));
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4));
}

function unitCost(cost: number, count: number) {
  return count === 0 ? null : roundCost(cost / count);
}

export function buildAIValueMetrics(events: AICostEvent[], activity: AIValueActivity, rules: AIValueEstimationInput) {
  const featureCost = (featureName: string) => events
    .filter((event) => event.featureName === featureName)
    .reduce((sum, event) => sum + (event.estimatedCostEur ?? 0), 0);
  const designerCost = featureCost("template_designer");
  const optimizerCost = featureCost("template_optimizer");
  const estimatedMinutesSaved =
    activity.templatesGenerated * rules.generatedTemplateMinutes
    + activity.optimizationProposalsGenerated * rules.optimizationProposalMinutes
    + activity.optimizedTemplateVersionsCreated * rules.optimizedTemplateVersionMinutes;
  const estimatedHoursSaved = Number((estimatedMinutesSaved / 60).toFixed(2));
  const relevantCost = roundCost(designerCost + optimizerCost);

  return {
    ...activity,
    validationRate: ratio(activity.templatesValidated, activity.templatesGenerated),
    optimizationAdoptionRate: ratio(activity.optimizationProposalsApproved, activity.optimizationProposalsGenerated),
    costPerGeneratedTemplateEur: unitCost(designerCost, activity.templatesGenerated),
    costPerValidatedTemplateEur: unitCost(designerCost, activity.templatesValidated),
    costPerOptimizedVersionEur: unitCost(optimizerCost, activity.optimizedTemplateVersionsCreated),
    estimatedMinutesSaved,
    estimatedHoursSaved,
    estimatedHoursPerEuro: relevantCost === 0 ? null : Number((estimatedHoursSaved / relevantCost).toFixed(2)),
    estimationRulesVersion: rules.version,
    estimationDisclaimerFr: rules.disclaimerFr,
  };
}

function eventPromptTokens(event: AICostEvent) {
  return event.promptTokens ?? event.tokensInput ?? 0;
}

function eventCompletionTokens(event: AICostEvent) {
  return event.completionTokens ?? event.tokensOutput ?? 0;
}

function aggregate(events: AICostEvent[], keyFor: (event: AICostEvent) => { key: string; label: string }) {
  const groups = new Map<string, AICostGroup>();
  for (const event of events) {
    const descriptor = keyFor(event);
    const current = groups.get(descriptor.key) ?? {
      ...descriptor,
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      costEur: 0,
    };
    current.calls += 1;
    current.promptTokens += eventPromptTokens(event);
    current.completionTokens += eventCompletionTokens(event);
    current.costEur += event.estimatedCostEur ?? 0;
    groups.set(descriptor.key, current);
  }
  return Array.from(groups.values())
    .map((group) => ({ ...group, costEur: roundCost(group.costEur) }))
    .sort((a, b) => b.costEur - a.costEur || b.calls - a.calls || a.label.localeCompare(b.label, "fr"));
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function buildAICostDashboard(events: AICostEvent[], now = new Date()) {
  const todayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const dailyEvents = events.filter((event) => event.createdAt >= todayStart && event.createdAt <= now);
  const monthlyEvents = events.filter((event) => event.createdAt >= monthStart && event.createdAt <= now);
  const summarize = (items: AICostEvent[]) => ({
    calls: items.length,
    promptTokens: items.reduce((sum, event) => sum + eventPromptTokens(event), 0),
    completionTokens: items.reduce((sum, event) => sum + eventCompletionTokens(event), 0),
    costEur: roundCost(items.reduce((sum, event) => sum + (event.estimatedCostEur ?? 0), 0)),
  });

  const dailyTrend = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(todayStart);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    const key = dayKey(date);
    const matching = events.filter((event) => dayKey(event.createdAt) === key);
    return { key, label: key.slice(5), ...summarize(matching) };
  });
  const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    const key = monthKey(date);
    const matching = events.filter((event) => monthKey(event.createdAt) === key);
    return { key, label: key, ...summarize(matching) };
  });

  return {
    daily: summarize(dailyEvents),
    monthly: summarize(monthlyEvents),
    allTime: summarize(events),
    byFeature: aggregate(events, (event) => ({ key: event.featureName ?? "unattributed", label: event.featureName ?? "Non attribué" })),
    byModel: aggregate(events, (event) => ({ key: `${event.provider}:${event.model ?? "unknown"}`, label: `${event.provider} / ${event.model ?? "modèle inconnu"}` })),
    byTemplate: aggregate(events, (event) => ({ key: event.templateId ?? "unattributed", label: event.templateName ?? "Sans template" })),
    dailyTrend,
    monthlyTrend,
  };
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildAICostCsv(events: AICostEvent[], valueMetrics?: ReturnType<typeof buildAIValueMetrics>) {
  const headers = [
    "timestamp", "provider", "model", "feature", "prompt_tokens", "completion_tokens", "estimated_cost_eur",
    "status", "user_email", "organization_id", "organization_name", "template_id", "template_name",
  ];
  const rows = events.map((event) => [
    event.createdAt.toISOString(), event.provider, event.model, event.featureName, eventPromptTokens(event),
    eventCompletionTokens(event), event.estimatedCostEur ?? 0, event.status, event.userEmail, event.organizationId,
    event.organizationName, event.templateId, event.templateName,
  ]);
  const eventCsv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  if (!valueMetrics) return eventCsv;

  const valueRows = [
    ["value_metric", "value", "unit", "estimation_rules_version", "notice"],
    ["templates_generated", valueMetrics.templatesGenerated, "count", "", ""],
    ["templates_validated", valueMetrics.templatesValidated, "count", "", ""],
    ["optimization_proposals_generated", valueMetrics.optimizationProposalsGenerated, "count", "", ""],
    ["optimization_proposals_approved", valueMetrics.optimizationProposalsApproved, "count", "", ""],
    ["optimized_template_versions_created", valueMetrics.optimizedTemplateVersionsCreated, "count", "", ""],
    ["validation_rate", valueMetrics.validationRate, "ratio", "", ""],
    ["optimization_adoption_rate", valueMetrics.optimizationAdoptionRate, "ratio", "", ""],
    ["cost_per_generated_template", valueMetrics.costPerGeneratedTemplateEur, "EUR", "", ""],
    ["cost_per_validated_template", valueMetrics.costPerValidatedTemplateEur, "EUR", "", ""],
    ["cost_per_optimized_version", valueMetrics.costPerOptimizedVersionEur, "EUR", "", ""],
    ["estimated_minutes_saved", valueMetrics.estimatedMinutesSaved, "estimated_minutes", valueMetrics.estimationRulesVersion, valueMetrics.estimationDisclaimerFr],
    ["estimated_hours_saved", valueMetrics.estimatedHoursSaved, "estimated_hours", valueMetrics.estimationRulesVersion, valueMetrics.estimationDisclaimerFr],
  ];
  return `${eventCsv}\r\n\r\n${valueRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
