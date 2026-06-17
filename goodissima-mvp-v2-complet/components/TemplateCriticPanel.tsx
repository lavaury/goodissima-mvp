"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

type Issue = { code: string; message: string; path?: string };
type Suggestion = { code: string; message: string; path?: string };
type CriticReport = {
  criticVersion: string;
  criticalIssues: Issue[];
  warnings: Issue[];
  improvementSuggestions: Suggestion[];
  overallQualityScore: number;
  analyzedAt: string;
};
type OptimizationChange = {
  path: string;
  sourceIssueCode: string;
  explanation: string;
  before: unknown;
  after: unknown;
};
type OptimizationProposal = {
  optimizerVersion: string;
  language: "fr";
  originalScore: number;
  projectedScore: number;
  changes: OptimizationChange[];
  unresolvedSuggestions: Suggestion[];
  generatedAt: string;
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Non renseigné";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function ReportList({ title, items, tone }: { title: string; items: Array<Issue | Suggestion>; tone: "red" | "amber" | "blue" }) {
  const classes = {
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${classes}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm opacity-75">Aucun élément.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}
        </ul>
      )}
    </div>
  );
}

export function TemplateCriticPanel({
  templateId,
  versions,
}: {
  templateId: string;
  versions: Array<{ id: string; version: number; isPublished: boolean }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [versionId, setVersionId] = useState(versions[0]?.id ?? "");
  const [report, setReport] = useState<CriticReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [analyzedVersion, setAnalyzedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizationId, setOptimizationId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<OptimizationProposal | null>(null);
  const [approved, setApproved] = useState(false);
  const [optimizationLoading, setOptimizationLoading] = useState<"generate" | "approve" | null>(null);

  async function analyze() {
    if (!versionId) return;
    setLoading(true);
    const response = await fetch(`/api/templates/${templateId}/critic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    setLoading(false);
    if (!response.ok) {
      try {
        const body = await response.json();
        toast.error(typeof body.error === "string" ? body.error : "Analyse impossible");
      } catch {
        toast.error("Analyse impossible");
      }
      return;
    }
    const body = await response.json();
    setReport(body.report);
    setReportId(body.reportId);
    setAnalyzedVersion(body.templateVersion.version);
    setOptimizationId(null);
    setProposal(null);
    setApproved(false);
    toast.success("Analyse enregistrée dans l'audit du parcours.");
  }

  async function optimize() {
    if (!report || !reportId || !analyzedVersion) return;
    setOptimizationLoading("generate");
    const response = await fetch(`/api/templates/${templateId}/critic/${reportId}/optimize`, { method: "POST" });
    setOptimizationLoading(null);
    if (!response.ok) {
      try {
        const body = await response.json();
        toast.error(typeof body.error === "string" ? body.error : "Optimisation impossible");
      } catch {
        toast.error("Optimisation impossible");
      }
      return;
    }
    const body = await response.json();
    setOptimizationId(body.optimizationId);
    setProposal(body.proposal);
    setApproved(false);
    toast.success("Proposition d'optimisation créée sans modifier le parcours.");
  }

  async function approveOptimization() {
    if (!optimizationId || !approved) return;
    setOptimizationLoading("approve");
    const response = await fetch(`/api/templates/${templateId}/optimizations/${optimizationId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanApproved: true }),
    });
    setOptimizationLoading(null);
    if (!response.ok) {
      try {
        const body = await response.json();
        toast.error(typeof body.error === "string" ? body.error : "Approbation impossible");
      } catch {
        toast.error("Approbation impossible");
      }
      return;
    }
    const body = await response.json();
    toast.success(`Brouillon d'optimisation v${body.templateVersion.version} créé, non publié.`);
    setApproved(false);
    router.refresh();
  }

  return (
    <section id="journey-analysis" className="mt-8 scroll-mt-6 rounded-2xl border border-blue-200 bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Template Critic</p>
          <h2 className="mt-1 font-semibold">Analyse du parcours</h2>
          <p className="mt-1 text-sm text-slate-500">
            Analyse en lecture seule d'une version figée. Aucun champ n'est modifié, publié ou exécuté.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-xl border px-3 py-2 text-sm" value={versionId} onChange={(event) => { setVersionId(event.target.value); setReport(null); setReportId(null); setAnalyzedVersion(null); setProposal(null); setOptimizationId(null); setApproved(false); }} disabled={loading || versions.length === 0}>
            {versions.map((version) => <option key={version.id} value={version.id}>v{version.version}{version.isPublished ? " - publiée" : " - brouillon"}</option>)}
          </select>
          <button type="button" onClick={() => void analyze()} disabled={loading || !versionId} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {loading ? "Analyse..." : "Analyser cette version"}
          </button>
        </div>
      </div>

      {versions.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Publiez ou créez une version de brouillon avant de lancer l'analyse.</p> : null}

      {report ? (
        <div className="mt-6" aria-live="polite">
          <div className="flex flex-wrap items-end gap-4 rounded-xl bg-slate-950 p-5 text-white">
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Score qualité</p><p className="mt-1 text-4xl font-bold">{report.overallQualityScore}/100</p></div>
            <p className="pb-1 text-sm text-slate-300">Version analysée : v{analyzedVersion} · {report.criticVersion}</p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <ReportList title="Problèmes critiques" items={report.criticalIssues} tone="red" />
            <ReportList title="Avertissements" items={report.warnings} tone="amber" />
            <ReportList title="Suggestions d'amélioration" items={report.improvementSuggestions} tone="blue" />
          </div>
          <button type="button" onClick={() => void optimize()} disabled={optimizationLoading !== null} className="mt-4 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 disabled:opacity-50">
            {optimizationLoading === "generate" ? "Génération..." : "Générer une proposition d'optimisation"}
          </button>
        </div>
      ) : null}

      {proposal ? (
        <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/40 p-5" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Proposition uniquement</p>
              <h3 className="mt-1 font-semibold">Optimisation expliquée</h3>
              <p className="mt-1 text-sm text-slate-600">Sortie française · {proposal.optimizerVersion} · aucune modification appliquée</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white px-4 py-3 text-center ring-1 ring-slate-200"><p className="text-xs text-slate-500">Original</p><p className="text-xl font-bold">{proposal.originalScore}</p></div>
              <span className="text-slate-400">→</span>
              <div className="rounded-xl bg-violet-700 px-4 py-3 text-center text-white"><p className="text-xs text-violet-100">Projeté</p><p className="text-xl font-bold">{proposal.projectedScore}</p></div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {proposal.changes.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Aucune modification déterministe proposée. Les suggestions restantes nécessitent une conception humaine.</p> : proposal.changes.map((change, index) => (
              <div key={`${change.path}-${index}`} className="rounded-xl border bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{change.explanation}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{change.path} · {change.sourceIssueCode}</p>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div className="rounded-lg bg-red-50 p-3 text-red-900"><span className="font-medium">Avant :</span> {formatValue(change.before)}</div>
                  <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900"><span className="font-medium">Proposé :</span> {formatValue(change.after)}</div>
                </div>
              </div>
            ))}
          </div>
          {proposal.unresolvedSuggestions.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Suggestions nécessitant une décision humaine</p>
              <ul className="mt-2 space-y-1">{proposal.unresolvedSuggestions.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>
            </div>
          ) : null}
          <label className="mt-4 flex items-start gap-2 rounded-xl border bg-white p-4 text-sm text-slate-800">
            <input type="checkbox" className="mt-0.5" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
            J'ai relu chaque changement et j'approuve la création d'une nouvelle version brouillon non publiée. La version source restera inchangée.
          </label>
          <button type="button" onClick={() => void approveOptimization()} disabled={!approved || optimizationLoading !== null} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {optimizationLoading === "approve" ? "Création..." : "Approuver et créer le brouillon"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
