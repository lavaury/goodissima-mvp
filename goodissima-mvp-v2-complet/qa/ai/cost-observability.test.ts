import assert from "node:assert/strict";
import test from "node:test";
import { AI_VALUE_ESTIMATION_INPUT } from "../../config/ai-value-estimation";
import { buildAICostCsv, buildAICostDashboard, buildAIValueMetrics, type AICostEvent } from "../../lib/ai/cost-observability";
import { buildAdvancedValueCsv, buildEstimatedValueIndex, buildValidationTrends, buildValueByFeature, buildValueByTemplate, type AIValueAnalyticsInput } from "../../lib/ai/value-analytics";

const events: AICostEvent[] = [
  { id: "1", provider: "mistral", model: "small", featureName: "relation_summary", promptTokens: 100, completionTokens: 25, estimatedCostEur: 0.001, status: "success", userId: "u1", userEmail: "admin@example.com", organizationId: "u1", organizationName: "Acme, France", templateId: "t1", templateName: "Recrutement", createdAt: new Date("2026-06-14T08:00:00.000Z") },
  { id: "2", provider: "mistral", model: "small", featureName: "draft_assistant", promptTokens: 200, completionTokens: 50, estimatedCostEur: 0.002, status: "success", userId: "u1", userEmail: "admin@example.com", organizationId: "u1", organizationName: "Acme, France", templateId: "t1", templateName: "Recrutement", createdAt: new Date("2026-06-13T08:00:00.000Z") },
  { id: "3", provider: "mock", model: "scenario", featureName: "template_designer", promptTokens: null, completionTokens: null, tokensInput: 10, tokensOutput: 5, estimatedCostEur: null, status: "success", userId: "u1", userEmail: "admin@example.com", organizationId: "u1", organizationName: "Acme, France", templateId: null, templateName: null, createdAt: new Date("2026-05-20T08:00:00.000Z") },
];

const analyticsInput: AIValueAnalyticsInput = {
  events: [
    ...events,
    { ...events[0], id: "4", featureName: "risk_signals", estimatedCostEur: 0.01, templateId: "t2", templateName: "Admission", createdAt: new Date("2026-06-12T08:00:00.000Z") },
    { ...events[0], id: "5", featureName: "matching_analysis", estimatedCostEur: 0.003, templateId: "t1", createdAt: new Date("2026-06-11T08:00:00.000Z") },
  ],
  generations: [
    { id: "g1", templateId: "t1", templateName: "Recrutement", createdAt: new Date("2026-06-10T08:00:00.000Z"), validatedAt: new Date("2026-06-11T08:00:00.000Z"), costEur: 0.01 },
    { id: "g2", templateId: "t1", templateName: "Recrutement", createdAt: new Date("2026-06-12T08:00:00.000Z"), validatedAt: null, costEur: 0.02 },
    { id: "g3", templateId: "t2", templateName: "Admission", createdAt: new Date("2026-06-13T08:00:00.000Z"), validatedAt: new Date("2026-06-14T08:00:00.000Z"), costEur: 0.03 },
  ],
  optimizations: [
    { id: "o1", templateId: "t1", templateName: "Recrutement", createdAt: new Date("2026-06-12T10:00:00.000Z"), approvedAt: new Date("2026-06-13T10:00:00.000Z"), draftVersionCreatedAt: new Date("2026-06-13T10:00:00.000Z"), costEur: 0.005 },
    { id: "o2", templateId: "t2", templateName: "Admission", createdAt: new Date("2026-06-13T10:00:00.000Z"), approvedAt: null, draftVersionCreatedAt: null, costEur: 0.006 },
  ],
  criticReports: [
    { id: "c1", templateId: "t1", templateName: "Recrutement", createdAt: new Date("2026-06-11T10:00:00.000Z"), costEur: 0 },
  ],
};

test("aggregates daily, monthly, feature, model and template costs", () => {
  const dashboard = buildAICostDashboard(events, new Date("2026-06-14T12:00:00.000Z"));
  assert.deepEqual(dashboard.daily, { calls: 1, promptTokens: 100, completionTokens: 25, costEur: 0.001 });
  assert.deepEqual(dashboard.monthly, { calls: 2, promptTokens: 300, completionTokens: 75, costEur: 0.003 });
  assert.equal(dashboard.byFeature.find((row) => row.key === "relation_summary")?.costEur, 0.001);
  assert.equal(dashboard.byModel.find((row) => row.key === "mistral:small")?.calls, 2);
  assert.equal(dashboard.byTemplate.find((row) => row.key === "t1")?.costEur, 0.003);
  assert.equal(dashboard.dailyTrend.length, 30);
  assert.equal(dashboard.monthlyTrend.length, 12);
});

test("falls back to legacy token columns", () => {
  const dashboard = buildAICostDashboard([events[2]], new Date("2026-05-20T12:00:00.000Z"));
  assert.equal(dashboard.daily.promptTokens, 10);
  assert.equal(dashboard.daily.completionTokens, 5);
});

test("exports complete CSV rows with escaping", () => {
  const csv = buildAICostCsv(events);
  assert.match(csv, /prompt_tokens,completion_tokens,estimated_cost_eur/);
  assert.match(csv, /"Acme, France"/);
  assert.match(csv, /relation_summary/);
  assert.equal(csv.split("\r\n").length, 4);
});

test("derives template value rates, unit costs and estimated savings", () => {
  const value = buildAIValueMetrics(events, {
    templatesGenerated: 4,
    templatesValidated: 3,
    optimizationProposalsGenerated: 2,
    optimizationProposalsApproved: 1,
    optimizedTemplateVersionsCreated: 1,
  }, AI_VALUE_ESTIMATION_INPUT);

  assert.equal(value.validationRate, 0.75);
  assert.equal(value.optimizationAdoptionRate, 0.5);
  assert.equal(value.costPerGeneratedTemplateEur, 0);
  assert.equal(value.costPerValidatedTemplateEur, 0);
  assert.equal(value.estimatedMinutesSaved, 230);
  assert.equal(value.estimatedHoursSaved, 3.83);
  assert.match(value.estimationDisclaimerFr, /Estimations/);
});

test("does not invent rates or unit costs without a denominator", () => {
  const value = buildAIValueMetrics(events, {
    templatesGenerated: 0,
    templatesValidated: 0,
    optimizationProposalsGenerated: 0,
    optimizationProposalsApproved: 0,
    optimizedTemplateVersionsCreated: 0,
  }, AI_VALUE_ESTIMATION_INPUT);

  assert.equal(value.validationRate, null);
  assert.equal(value.optimizationAdoptionRate, null);
  assert.equal(value.costPerGeneratedTemplateEur, null);
  assert.equal(value.estimatedHoursSaved, 0);
});

test("exports value metrics with estimation governance metadata", () => {
  const value = buildAIValueMetrics(events, {
    templatesGenerated: 1,
    templatesValidated: 1,
    optimizationProposalsGenerated: 0,
    optimizationProposalsApproved: 0,
    optimizedTemplateVersionsCreated: 0,
  }, AI_VALUE_ESTIMATION_INPUT);
  const csv = buildAICostCsv(events, value);

  assert.match(csv, /value_metric,value,unit,estimation_rules_version,notice/);
  assert.match(csv, /estimated_hours_saved/);
  assert.match(csv, /1\.0\.0/);
  assert.match(csv, /non mesurées/);
});

test("aggregates and sorts value by template", () => {
  const byGenerated = buildValueByTemplate(analyticsInput, AI_VALUE_ESTIMATION_INPUT, "generated");
  assert.equal(byGenerated[0].templateName, "Recrutement");
  assert.equal(byGenerated[0].templatesGenerated, 2);
  assert.equal(byGenerated[0].templatesValidated, 1);
  assert.equal(byGenerated[0].validationRate, 0.5);
  assert.equal(byGenerated[0].optimizedVersionsCreated, 1);
  assert.equal(byGenerated[0].estimatedMinutesSaved, 120);
  assert.equal(byGenerated[0].totalCostEur, 0.041);

  const byCost = buildValueByTemplate(analyticsInput, AI_VALUE_ESTIMATION_INPUT, "totalCost");
  assert.equal(byCost[0].templateName, "Admission");
});

test("aggregates value by feature and successful outcomes", () => {
  const rows = buildValueByFeature(analyticsInput, AI_VALUE_ESTIMATION_INPUT);
  const designer = rows.find((row) => row.feature === "template_designer");
  const optimizer = rows.find((row) => row.feature === "template_optimizer");
  const matching = rows.find((row) => row.feature === "matching_analysis");
  assert.equal(designer?.calls, 3);
  assert.equal(designer?.templatesInfluenced, 2);
  assert.equal(designer?.successfulOutcomes, 2);
  assert.equal(optimizer?.successfulOutcomes, 1);
  assert.equal(optimizer?.estimatedMinutesSaved, 50);
  assert.equal(matching?.calls, 1);
  assert.equal(matching?.estimatedMinutesSaved, 15);
});

test("calculates validation and optimization cohort trends", () => {
  const trends = buildValidationTrends(analyticsInput, "30d", new Date("2026-06-14T12:00:00.000Z"));
  assert.equal(trends.length, 30);
  const june12 = trends.find((point) => point.key === "2026-06-12");
  assert.equal(june12?.generated, 1);
  assert.equal(june12?.validated, 0);
  assert.equal(june12?.validationRate, 0);
  assert.equal(june12?.optimizationAdoptionRate, 1);

  const monthly = buildValidationTrends(analyticsInput, "12m", new Date("2026-06-14T12:00:00.000Z"));
  assert.equal(monthly.length, 12);
  assert.equal(monthly.at(-1)?.validationRate, 0.6667);
});

test("calculates the governed estimated value index", () => {
  const index = buildEstimatedValueIndex({ validationRate: 0.75, optimizationAdoptionRate: 0.5, optimizedVersions: 1, generatedTemplates: 4 }, { validation: 0.5, optimizationAdoption: 0.3, optimizedConversion: 0.2 });
  assert.equal(index, 57.5);
});

test("exports advanced template, feature, trend and ROI sections", () => {
  const templates = buildValueByTemplate(analyticsInput, AI_VALUE_ESTIMATION_INPUT);
  const features = buildValueByFeature(analyticsInput, AI_VALUE_ESTIMATION_INPUT);
  const trends = buildValidationTrends(analyticsInput, "30d", new Date("2026-06-14T12:00:00.000Z"));
  const csv = buildAdvancedValueCsv({ templates, features, trends, roi: { estimated_value_index: 57.5 }, disclaimer: "Estimated – not financial accounting data." });
  assert.match(csv, /value_by_template/);
  assert.match(csv, /value_by_feature/);
  assert.match(csv, /validation_trends/);
  assert.match(csv, /roi_indicators/);
  assert.match(csv, /Estimated – not financial accounting data\./);
});
