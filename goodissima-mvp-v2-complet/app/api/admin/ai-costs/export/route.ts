import { getCurrentPrismaUser } from "@/lib/auth";
import { buildAICostCsv, buildAIValueMetrics } from "@/lib/ai/cost-observability";
import { getOrganizationAICostEvents, getOrganizationAIValueActivity, getOrganizationAIValueAnalyticsData } from "@/lib/ai/cost-data";
import { buildAdvancedValueCsv, buildEstimatedValueIndex, buildValidationTrends, buildValueByFeature, buildValueByTemplate, type ValueAnalyticsPeriod } from "@/lib/ai/value-analytics";
import { AI_VALUE_ESTIMATION_INPUT, AI_VALUE_ESTIMATION_RULES } from "@/config/ai-value-estimation";

export async function GET(req: Request) {
  const owner = await getCurrentPrismaUser();
  const requestedPeriod = new URL(req.url).searchParams.get("period");
  const period: ValueAnalyticsPeriod = requestedPeriod === "30d" || requestedPeriod === "90d" ? requestedPeriod : "12m";
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 12);
  const events = await getOrganizationAICostEvents(owner.id, since);
  const [activity, records] = await Promise.all([
    getOrganizationAIValueActivity(owner.id, since),
    getOrganizationAIValueAnalyticsData(owner.id, events, since),
  ]);
  const valueMetrics = buildAIValueMetrics(events, activity, AI_VALUE_ESTIMATION_INPUT);
  const analyticsInput = { events, ...records };
  const estimatedValueIndex = buildEstimatedValueIndex({
    validationRate: valueMetrics.validationRate,
    optimizationAdoptionRate: valueMetrics.optimizationAdoptionRate,
    optimizedVersions: valueMetrics.optimizedTemplateVersionsCreated,
    generatedTemplates: valueMetrics.templatesGenerated,
  }, AI_VALUE_ESTIMATION_RULES.estimatedValueIndexWeights);
  const notice = "Estimated – not financial accounting data.";
  const advancedCsv = buildAdvancedValueCsv({
    templates: buildValueByTemplate(analyticsInput, AI_VALUE_ESTIMATION_INPUT),
    features: buildValueByFeature(analyticsInput, AI_VALUE_ESTIMATION_INPUT),
    trends: buildValidationTrends(analyticsInput, period),
    roi: {
      cost_per_generated_template_eur: valueMetrics.costPerGeneratedTemplateEur,
      cost_per_validated_template_eur: valueMetrics.costPerValidatedTemplateEur,
      cost_per_optimized_version_eur: valueMetrics.costPerOptimizedVersionEur,
      estimated_hours_saved_per_euro: valueMetrics.estimatedHoursPerEuro,
      estimated_value_index: estimatedValueIndex,
    },
    disclaimer: notice,
  });
  const csv = `${buildAICostCsv(events, valueMetrics)}\r\n\r\n${advancedCsv}`;
  const date = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="goodissima-ai-costs-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
