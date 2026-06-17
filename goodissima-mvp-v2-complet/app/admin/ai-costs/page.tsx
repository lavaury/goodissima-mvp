export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { AICostTrendChart } from "@/components/AICostTrendChart";
import { AIValueTrendChart } from "@/components/AIValueTrendChart";
import { ActiveOrganizationBadge } from "@/components/ActiveOrganizationBadge";
import { DashboardBackLink } from "@/components/DashboardBackLink";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { buildAICostDashboard, buildAIValueMetrics, type AICostGroup } from "@/lib/ai/cost-observability";
import { getOrganizationAICostEvents, getOrganizationAIValueActivity, getOrganizationAIValueAnalyticsData } from "@/lib/ai/cost-data";
import { buildEstimatedValueIndex, buildValidationTrends, buildValueByFeature, buildValueByTemplate, type TemplateValueSort, type ValueAnalyticsPeriod } from "@/lib/ai/value-analytics";
import { AI_VALUE_ESTIMATION_INPUT, AI_VALUE_ESTIMATION_RULES } from "@/config/ai-value-estimation";

const featureLabels: Record<string, string> = {
  relation_summary: "Résumé relationnel",
  timeline_intelligence: "Intelligence chronologique",
  draft_assistant: "Assistant de rédaction",
  risk_signals: "Signaux de risque",
  template_designer: "Template Designer",
  semantic_embedding: "Embeddings sémantiques",
  template_critic: "Template Critic",
  template_optimizer: "Template Optimizer",
  matching_analysis: "Analyse de matching",
};
const roiNotice = "Estimated – not financial accounting data.";

function euros(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function percentage(value: number | null) {
  return value === null ? "Non calculable" : new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function optionalEuros(value: number | null) {
  return value === null ? "Non calculable" : euros(value);
}

function BreakdownTable({ title, rows, labels }: { title: string; rows: AICostGroup[]; labels?: Record<string, string> }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-slate-500"><tr><th className="py-2">Élément</th><th>Appels</th><th>Tokens prompt</th><th>Tokens réponse</th><th>Coût</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={5} className="border-t py-4 text-slate-500">Aucune donnée.</td></tr> : rows.map((row) => <tr key={row.key} className="border-t"><td className="py-3 font-medium">{labels?.[row.key] ?? row.label}</td><td>{number(row.calls)}</td><td>{number(row.promptTokens)}</td><td>{number(row.completionTokens)}</td><td>{euros(row.costEur)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AICostAdminPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  noStore();
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name ?? owner.email;
  const requestedPeriod = queryValue(searchParams?.period);
  const period: ValueAnalyticsPeriod = requestedPeriod === "30d" || requestedPeriod === "90d" ? requestedPeriod : "12m";
  const requestedSort = queryValue(searchParams?.sort);
  const sort: TemplateValueSort = ["generated", "validated", "validationRate", "estimatedTimeSaved", "totalCost"].includes(requestedSort ?? "") ? requestedSort as TemplateValueSort : "validated";
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 12);
  const events = await getOrganizationAICostEvents(owner.id, since);
  const [activity, records] = await Promise.all([
    getOrganizationAIValueActivity(owner.id, since),
    getOrganizationAIValueAnalyticsData(owner.id, events, since),
  ]);
  const analyticsInput = { events, ...records };
  const dashboard = buildAICostDashboard(events);
  const value = buildAIValueMetrics(events, activity, AI_VALUE_ESTIMATION_INPUT);
  const valueByTemplate = buildValueByTemplate(analyticsInput, AI_VALUE_ESTIMATION_INPUT, sort);
  const valueByFeature = buildValueByFeature(analyticsInput, AI_VALUE_ESTIMATION_INPUT);
  const trends = buildValidationTrends(analyticsInput, period);
  const estimatedValueIndex = buildEstimatedValueIndex({
    validationRate: value.validationRate,
    optimizationAdoptionRate: value.optimizationAdoptionRate,
    optimizedVersions: value.optimizedTemplateVersionsCreated,
    generatedTemplates: value.templatesGenerated,
  }, AI_VALUE_ESTIMATION_RULES.estimatedValueIndexWeights);
  const cards = [
    { label: "Coût aujourd'hui", value: euros(dashboard.daily.costEur), help: `${dashboard.daily.calls} appel(s)` },
    { label: "Coût ce mois", value: euros(dashboard.monthly.costEur), help: `${dashboard.monthly.calls} appel(s)` },
    { label: "Tokens prompt ce mois", value: number(dashboard.monthly.promptTokens), help: "Entrées envoyées aux modèles" },
    { label: "Tokens réponse ce mois", value: number(dashboard.monthly.completionTokens), help: "Sorties générées par les modèles" },
  ];
  const roiCards = [
    ["Coût par template généré", optionalEuros(value.costPerGeneratedTemplateEur)],
    ["Coût par template validé", optionalEuros(value.costPerValidatedTemplateEur)],
    ["Coût par version optimisée", optionalEuros(value.costPerOptimizedVersionEur)],
    ["Heures estimées par euro", value.estimatedHoursPerEuro === null ? "Non calculable" : String(value.estimatedHoursPerEuro)],
    ["Indice de valeur estimé", `${estimatedValueIndex} / 100`],
  ];
  const sortOptions: Array<[TemplateValueSort, string]> = [["generated", "Générés"], ["validated", "Validés"], ["validationRate", "Taux de validation"], ["estimatedTimeSaved", "Temps estimé"], ["totalCost", "Coût total"]];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><DashboardBackLink className="mb-4" /><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">IA & Valeur · Admin</p><h1 className="mt-2 text-3xl font-bold">IA & Valeur</h1><p className="mt-2 text-slate-500">Coût IA, valeur estimée, templates générés, templates validés, versions optimisées, ROI estimé et exports CSV.</p></div>
        <div className="flex flex-col items-end gap-3"><ActiveOrganizationBadge organizationName={organizationName} /><Link href={`/api/admin/ai-costs/export?period=${period}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Exporter en CSV</Link></div>
      </div>
      <div className="mt-8"><PlatformNavigation active="analytics" organizationName={organizationName} /></div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <div key={card.label} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-bold">{card.value}</p><p className="mt-2 text-xs text-slate-500">{card.help}</p></div>)}</section>

      <section className="mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Coût vs valeur</p><h2 className="mt-1 text-2xl font-bold">Tableau de bord ROI estimatif</h2></div><p className="text-xs text-violet-800">Règles gouvernées v{AI_VALUE_ESTIMATION_RULES.version}</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{roiCards.map(([label, metric]) => <div key={label} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{metric}</p><p className="mt-2 text-[11px] text-amber-700">{roiNotice}</p></div>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Taux de validation</p><p className="mt-2 text-xl font-bold">{percentage(value.validationRate)}</p></div>
          <div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Adoption des optimisations</p><p className="mt-2 text-xl font-bold">{percentage(value.optimizationAdoptionRate)}</p></div>
          <div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Temps économisé estimé</p><p className="mt-2 text-xl font-bold">{number(value.estimatedMinutesSaved)} min</p><p className="text-xs text-slate-500">{value.estimatedHoursSaved} h estimées</p></div>
          <div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Résultats observés</p><p className="mt-2 text-xl font-bold">{value.templatesValidated + value.optimizedTemplateVersionsCreated}</p><p className="text-xs text-slate-500">Validations et versions optimisées</p></div>
        </div>
        <p className="mt-4 text-xs text-violet-900"><strong>Important :</strong> {AI_VALUE_ESTIMATION_RULES.disclaimerFr} {roiNotice}</p>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-bold">Valeur par template</h2><p className="text-sm text-slate-500">Attribution des résultats, coûts et estimations aux parcours concernés.</p></div><div className="flex flex-wrap gap-2">{sortOptions.map(([key, label]) => <Link key={key} href={`?period=${period}&sort=${key}`} className={`rounded-lg px-3 py-2 text-xs font-medium ${sort === key ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</Link>)}</div></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="text-slate-500"><tr><th className="py-2">Template</th><th>Générés</th><th>Validés</th><th>Taux</th><th>Propositions</th><th>Approbations</th><th>Versions optimisées</th><th>Temps estimé</th><th>Heures estimées</th><th>Coût IA</th><th>Coût / validé</th></tr></thead><tbody>{valueByTemplate.length === 0 ? <tr><td colSpan={11} className="border-t py-4 text-slate-500">Aucune donnée.</td></tr> : valueByTemplate.map((row) => <tr key={row.key} className="border-t"><td className="py-3 font-medium">{row.templateName}</td><td>{row.templatesGenerated}</td><td>{row.templatesValidated}</td><td>{percentage(row.validationRate)}</td><td>{row.optimizationProposals}</td><td>{row.optimizationApprovals}</td><td>{row.optimizedVersionsCreated}</td><td>{row.estimatedMinutesSaved} min</td><td>{row.estimatedHoursSaved} h</td><td>{euros(row.totalCostEur)}</td><td>{optionalEuros(row.costPerValidatedTemplateEur)}</td></tr>)}</tbody></table></div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Valeur par fonctionnalité</h2><p className="mt-1 text-sm text-slate-500">Un résultat réussi correspond à une validation pour Designer, une approbation pour Optimizer, un rapport pour Critic et un appel réussi pour les autres fonctionnalités.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-slate-500"><tr><th className="py-2">Fonctionnalité</th><th>Appels</th><th>Coût</th><th>Templates influencés</th><th>Temps estimé</th><th>Heures estimées</th><th>Coût / résultat réussi</th></tr></thead><tbody>{valueByFeature.map((row) => <tr key={row.feature} className="border-t"><td className="py-3 font-medium">{row.label}</td><td>{row.calls}</td><td>{euros(row.costEur)}</td><td>{row.templatesInfluenced}</td><td>{row.estimatedMinutesSaved} min</td><td>{row.estimatedHoursSaved} h</td><td>{optionalEuros(row.costPerSuccessfulOutcomeEur)}</td></tr>)}</tbody></table></div></section>

      <section className="mt-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold">Tendances de qualité et de validation</h2><p className="text-sm text-slate-500">Cohortes calculées selon la date de génération ou de proposition.</p></div><div className="flex gap-2">{([["30d", "30 jours"], ["90d", "90 jours"], ["12m", "12 mois"]] as Array<[ValueAnalyticsPeriod, string]>).map(([key, label]) => <Link key={key} href={`?period=${key}&sort=${sort}`} className={`rounded-lg px-3 py-2 text-xs font-medium ${period === key ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</Link>)}</div></div>
        <div className="mt-4 grid gap-6 xl:grid-cols-2"><AIValueTrendChart title="Templates générés vs validés" points={trends} series={[{ key: "generated", label: "Générés", color: "#7c3aed" }, { key: "validated", label: "Validés", color: "#16a34a" }]} /><AIValueTrendChart title="Tendance du taux de validation" points={trends} percent series={[{ key: "validationRate", label: "Taux de validation", color: "#2563eb" }]} /><AIValueTrendChart title="Tendance d'adoption des optimisations" points={trends} percent series={[{ key: "optimizationAdoptionRate", label: "Taux d'adoption", color: "#ea580c" }]} /></div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2"><AICostTrendChart title="Tendance quotidienne des coûts sur 30 jours" points={dashboard.dailyTrend} /><AICostTrendChart title="Tendance mensuelle des coûts sur 12 mois" points={dashboard.monthlyTrend} /></div>
      <div className="mt-8 grid gap-6 xl:grid-cols-2"><BreakdownTable title="Coût par fonctionnalité" rows={dashboard.byFeature} labels={featureLabels} /><BreakdownTable title="Coût par modèle" rows={dashboard.byModel} /></div>
      <div className="mt-8"><BreakdownTable title="Coût par template" rows={dashboard.byTemplate} /></div>
      <p className="mt-6 text-xs text-slate-500">Les coûts et gains de temps sont estimés à partir des métriques provider et des règles gouvernées. Les appels mock ou sans tarification connue apparaissent avec un coût nul.</p>
    </main>
  );
}
