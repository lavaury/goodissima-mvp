import { prisma } from "@/lib/prisma";
import type { AICostEvent, AIValueActivity } from "@/lib/ai/cost-observability";
import type { AIValueAnalyticsInput } from "@/lib/ai/value-analytics";

function generatedTemplateName(output: unknown) {
  if (!output || typeof output !== "object" || Array.isArray(output)) return "Brouillon sans nom";
  const name = (output as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : "Brouillon sans nom";
}

export async function getOrganizationAIValueAnalyticsData(ownerId: string, events: AICostEvent[], since?: Date): Promise<Omit<AIValueAnalyticsInput, "events">> {
  const createdAt = since ? { gte: since } : undefined;
  const [generations, optimizations, criticReports] = await Promise.all([
    prisma.templateGeneration.findMany({
      where: { createdById: ownerId, ...(createdAt ? { createdAt } : {}) },
      include: { template: { select: { id: true, name: true } }, aiEvent: { select: { estimatedCostEur: true } } },
    }),
    prisma.templateOptimization.findMany({
      where: { createdById: ownerId, ...(createdAt ? { createdAt } : {}) },
      include: { sourceVersion: { include: { template: { select: { id: true, name: true } } } }, draftVersion: { select: { createdAt: true } } },
    }),
    prisma.templateCriticReport.findMany({
      where: { createdById: ownerId, ...(createdAt ? { createdAt } : {}) },
      include: { templateVersion: { include: { template: { select: { id: true, name: true } } } } },
    }),
  ]);
  const featureTemplateCost = (feature: string, templateId: string) => events
    .filter((event) => event.featureName === feature && event.templateId === templateId)
    .reduce((sum, event) => sum + (event.estimatedCostEur ?? 0), 0);
  const optimizationCounts = new Map<string, number>();
  const criticCounts = new Map<string, number>();
  optimizations.forEach((item) => optimizationCounts.set(item.sourceVersion.template.id, (optimizationCounts.get(item.sourceVersion.template.id) ?? 0) + 1));
  criticReports.forEach((item) => criticCounts.set(item.templateVersion.template.id, (criticCounts.get(item.templateVersion.template.id) ?? 0) + 1));

  return {
    generations: generations.map((item) => ({
      id: item.id,
      templateId: item.templateId,
      templateName: item.template?.name ?? generatedTemplateName(item.output),
      createdAt: item.createdAt,
      validatedAt: item.validatedAt,
      costEur: item.aiEvent?.estimatedCostEur === null || item.aiEvent?.estimatedCostEur === undefined ? 0 : Number(item.aiEvent.estimatedCostEur),
    })),
    optimizations: optimizations.map((item) => ({
      id: item.id,
      templateId: item.sourceVersion.template.id,
      templateName: item.sourceVersion.template.name,
      createdAt: item.createdAt,
      approvedAt: item.approvedAt,
      draftVersionCreatedAt: item.draftVersion?.createdAt ?? null,
      costEur: featureTemplateCost("template_optimizer", item.sourceVersion.template.id) / (optimizationCounts.get(item.sourceVersion.template.id) ?? 1),
    })),
    criticReports: criticReports.map((item) => ({
      id: item.id,
      templateId: item.templateVersion.template.id,
      templateName: item.templateVersion.template.name,
      createdAt: item.createdAt,
      costEur: featureTemplateCost("template_critic", item.templateVersion.template.id) / (criticCounts.get(item.templateVersion.template.id) ?? 1),
    })),
  };
}

export async function getOrganizationAIValueActivity(ownerId: string, since?: Date): Promise<AIValueActivity> {
  const createdAt = since ? { gte: since } : undefined;
  const generationCohort = { createdById: ownerId, ...(createdAt ? { createdAt } : {}) };
  const optimizationCohort = { createdById: ownerId, ...(createdAt ? { createdAt } : {}) };
  const [templatesGenerated, templatesValidated, optimizationProposalsGenerated, optimizationProposalsApproved, optimizedTemplateVersionsCreated] = await Promise.all([
    prisma.templateGeneration.count({ where: generationCohort }),
    prisma.templateGeneration.count({ where: { ...generationCohort, validatedAt: { not: null } } }),
    prisma.templateOptimization.count({ where: optimizationCohort }),
    prisma.templateOptimization.count({ where: { ...optimizationCohort, approvedAt: { not: null } } }),
    prisma.templateOptimization.count({ where: { createdById: ownerId, draftVersion: since ? { createdAt: { gte: since } } : { isNot: null } } }),
  ]);

  return { templatesGenerated, templatesValidated, optimizationProposalsGenerated, optimizationProposalsApproved, optimizedTemplateVersionsCreated };
}

export async function getOrganizationAICostEvents(ownerId: string, since?: Date): Promise<AICostEvent[]> {
  const events = await prisma.aIEvent.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      OR: [
        { userId: ownerId },
        { organizationId: ownerId },
        { case: { ownerId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, name: true } },
      template: { select: { id: true, name: true } },
      case: {
        select: {
          ownerId: true,
          owner: { select: { email: true, name: true } },
          template: { select: { id: true, name: true } },
        },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    provider: event.provider,
    model: event.model,
    featureName: event.featureName ?? event.action,
    promptTokens: event.promptTokens,
    completionTokens: event.completionTokens,
    tokensInput: event.tokensInput,
    tokensOutput: event.tokensOutput,
    estimatedCostEur: event.estimatedCostEur === null ? null : Number(event.estimatedCostEur),
    status: event.status,
    userId: event.userId ?? event.case?.ownerId ?? null,
    userEmail: event.user?.email ?? event.case?.owner.email ?? null,
    organizationId: event.organizationId ?? event.case?.ownerId ?? null,
    organizationName: event.organizationName ?? event.user?.name ?? event.case?.owner.name ?? event.user?.email ?? event.case?.owner.email ?? null,
    templateId: event.template?.id ?? event.case?.template?.id ?? null,
    templateName: event.template?.name ?? event.case?.template?.name ?? null,
    createdAt: event.createdAt,
  }));
}
