"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  advanceTemplateDemo,
  initialTemplateDemoState,
  templateDemoStepNumber,
  templateDemoSteps,
  type TemplateDemoEvent,
} from "@/lib/ai/template-demo-flow";

type Issue = { code: string; message: string; path?: string };
type Draft = {
  name: string;
  description: string;
  actors: Array<{ name: string; role: string }>;
  stages: Array<{ name: string; objective: string }>;
  documents: Array<{ name: string; required: boolean; stage: number }>;
  relationalRequests: Array<{ title: string; description: string; stage: number }>;
  kpis: Array<{ name: string; description: string; unit: string }>;
  fields: Array<Record<string, unknown>>;
};
type GuardReport = { valid: boolean; errors: Issue[]; warnings: Issue[] };
type CriticReport = {
  criticalIssues: Issue[];
  warnings: Issue[];
  improvementSuggestions: Issue[];
  overallQualityScore: number;
  criticVersion: string;
};
type OptimizationProposal = {
  optimizerVersion: string;
  originalScore: number;
  projectedScore: number;
  changes: Array<{ path: string; sourceIssueCode: string; explanation: string; before: unknown; after: unknown }>;
  unresolvedSuggestions: Issue[];
};
type Provenance = { provider: string; model: string; promptVersion: string; language: string; generatedAt: string };

const stepLabels = [
  "Décrire le besoin",
  "Brouillon IA",
  "Quality Guard",
  "Validation humaine v1",
  "Template Critic",
  "Template Optimizer",
  "Approbation humaine v2",
];

function valueLabel(value: unknown) {
  if (value === null || value === undefined || value === "") return "Non renseigné";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function IssueList({ items, empty }: { items: Issue[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return <ul className="space-y-1 text-sm">{items.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>;
}

async function responseError(response: Response) {
  try {
    const body = await response.json();
    return typeof body.error === "string" ? body.error : "Action impossible";
  } catch {
    return "Action impossible";
  }
}

export function TemplateAIDemoFlow() {
  const toast = useToast();
  const [flow, setFlow] = useState(initialTemplateDemoState);
  const [description, setDescription] = useState("Créer un parcours d'accueil de nouveaux partenaires avec collecte de documents, demandes de validation humaine et indicateurs de délai.");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [guard, setGuard] = useState<GuardReport | null>(null);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [critic, setCritic] = useState<CriticReport | null>(null);
  const [proposal, setProposal] = useState<OptimizationProposal | null>(null);
  const [v1Approved, setV1Approved] = useState(false);
  const [v2Approved, setV2Approved] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [audit, setAudit] = useState<Array<{ label: string; value: string }>>([]);

  const currentStep = templateDemoStepNumber(flow.step);
  function transition(event: TemplateDemoEvent) {
    setFlow((state) => advanceTemplateDemo(state, event));
  }
  function addAudit(label: string, value: string) {
    setAudit((items) => [...items, { label, value }]);
  }

  async function generateDraft() {
    setLoading("generate");
    const response = await fetch("/api/templates/ai-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    setLoading(null);
    if (!response.ok) return toast.error(await responseError(response));
    const body = await response.json();
    setDraft(body.draft);
    setGuard(body.validation);
    setProvenance(body.provenance);
    addAudit("Génération", `${body.generationId} · ${body.provenance.provider}/${body.provenance.model}`);
    transition({ type: "DRAFT_GENERATED", generationId: body.generationId });
  }

  function acknowledgeGuard() {
    transition({ type: "QUALITY_REVIEWED" });
    addAudit("Quality Guard", `${guard?.errors.length ?? 0} erreur(s), ${guard?.warnings.length ?? 0} avertissement(s)`);
  }

  async function createV1() {
    if (!flow.generationId || !draft || !v1Approved) return;
    setLoading("v1");
    const response = await fetch(`/api/templates/ai-generate/${flow.generationId}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanValidated: true, draft }),
    });
    setLoading(null);
    if (!response.ok) return toast.error(await responseError(response));
    const body = await response.json();
    transition({ type: "DRAFT_V1_CREATED", templateId: body.templateId, version: body.version, isPublished: body.isPublished });
    addAudit("Validation humaine v1", `${body.templateId} · DRAFT v${body.version} · non publiée`);
  }

  async function runCritic() {
    if (!flow.templateId) return;
    setLoading("critic");
    const response = await fetch(`/api/templates/${flow.templateId}/critic`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setLoading(null);
    if (!response.ok) return toast.error(await responseError(response));
    const body = await response.json();
    setCritic(body.report);
    transition({ type: "VERSION_CRITIQUED", criticReportId: body.reportId });
    addAudit("Critic", `${body.reportId} · score ${body.report.overallQualityScore}/100`);
  }

  async function optimize() {
    if (!flow.templateId || !flow.criticReportId) return;
    setLoading("optimizer");
    const response = await fetch(`/api/templates/${flow.templateId}/critic/${flow.criticReportId}/optimize`, { method: "POST" });
    setLoading(null);
    if (!response.ok) return toast.error(await responseError(response));
    const body = await response.json();
    setProposal(body.proposal);
    transition({ type: "OPTIMIZATION_PROPOSED", optimizationId: body.optimizationId });
    addAudit("Optimizer", `${body.optimizationId} · ${body.proposal.originalScore} → ${body.proposal.projectedScore}`);
  }

  async function createV2() {
    if (!flow.templateId || !flow.optimizationId || !v2Approved) return;
    setLoading("v2");
    const response = await fetch(`/api/templates/${flow.templateId}/optimizations/${flow.optimizationId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanApproved: true }),
    });
    setLoading(null);
    if (!response.ok) return toast.error(await responseError(response));
    const body = await response.json();
    transition({ type: "DRAFT_V2_CREATED", version: body.templateVersion.version, isPublished: body.templateVersion.isPublished });
    addAudit("Approbation humaine v2", `${body.templateVersion.id} · DRAFT v${body.templateVersion.version} · non publiée`);
  }

  function reset() {
    transition({ type: "RESET" });
    setDraft(null); setGuard(null); setProvenance(null); setCritic(null); setProposal(null);
    setV1Approved(false); setV2Approved(false); setAudit([]); setLoading(null);
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[240px_1fr_320px]">
      <aside className="rounded-2xl border bg-white p-4 xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Progression</p>
        <ol className="mt-4 space-y-2">
          {templateDemoSteps.map((step, index) => {
            const done = index + 1 < currentStep;
            const active = step === flow.step;
            return <li key={step} className={`rounded-xl px-3 py-2 text-sm ${active ? "bg-slate-900 text-white" : done ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"}`}><span className="font-semibold">{index + 1}.</span> {stepLabels[index]}</li>;
          })}
        </ol>
      </aside>

      <div className="space-y-5">
        <section className="rounded-2xl border bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Étape 1</p>
          <h2 className="mt-1 text-xl font-semibold">Décrivez votre besoin</h2>
          <textarea className="mt-4 min-h-28 w-full rounded-xl border px-4 py-3" value={description} disabled={currentStep > 1} onChange={(event) => setDescription(event.target.value)} />
          <button type="button" onClick={() => void generateDraft()} disabled={currentStep !== 1 || loading !== null || description.trim().length < 20} className="mt-3 rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading === "generate" ? "Génération..." : "Générer le brouillon IA"}</button>
        </section>

        {draft ? <section className="rounded-2xl border bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Étape 2</p><h2 className="mt-1 text-xl font-semibold">Brouillon généré</h2><h3 className="mt-4 font-semibold">{draft.name}</h3><p className="mt-1 text-sm text-slate-600">{draft.description}</p><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4 text-sm"><strong>Acteurs</strong><p className="mt-1">{draft.actors.map((item) => item.name).join(", ")}</p></div><div className="rounded-xl bg-slate-50 p-4 text-sm"><strong>Étapes</strong><p className="mt-1">{draft.stages.map((item) => item.name).join(", ")}</p></div><div className="rounded-xl bg-slate-50 p-4 text-sm"><strong>Demandes / documents</strong><p className="mt-1">{draft.relationalRequests.length} demande(s), {draft.documents.length} document(s)</p></div><div className="rounded-xl bg-slate-50 p-4 text-sm"><strong>KPI</strong><p className="mt-1">{draft.kpis.map((item) => item.name).join(", ")}</p></div></div>{flow.step === "DRAFT_GENERATED" ? <button type="button" onClick={acknowledgeGuard} className="mt-4 rounded-xl border px-4 py-2 text-sm font-medium">Afficher et examiner le Quality Guard</button> : null}</section> : null}

        {guard && currentStep >= 3 ? <section className="rounded-2xl border bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Étape 3</p><h2 className="mt-1 text-xl font-semibold">Rapport Quality Guard</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><h3 className="font-semibold">Erreurs critiques</h3><div className="mt-2"><IssueList items={guard.errors} empty="Aucune erreur critique." /></div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><h3 className="font-semibold">Avertissements</h3><div className="mt-2"><IssueList items={guard.warnings} empty="Aucun avertissement." /></div></div></div>{flow.step === "QUALITY_REVIEWED" ? <><label className="mt-4 flex gap-2 rounded-xl border p-4 text-sm"><input type="checkbox" checked={v1Approved} disabled={!guard.valid} onChange={(event) => setV1Approved(event.target.checked)} />J'ai relu le brouillon et j'approuve la création de DRAFT v1 non publiée.</label><button type="button" onClick={() => void createV1()} disabled={!v1Approved || loading !== null || !guard.valid} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading === "v1" ? "Création..." : "Créer DRAFT v1"}</button></> : null}</section> : null}

        {flow.version1 ? <section className="rounded-2xl border border-emerald-200 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Étape 4</p><h2 className="mt-1 text-xl font-semibold">DRAFT v1 créée par validation humaine</h2><p className="mt-2 text-sm text-slate-600">Version {flow.version1.version}, publication: non. Aucun workflow n'a été exécuté.</p>{flow.step === "DRAFT_V1_CREATED" ? <button type="button" onClick={() => void runCritic()} disabled={loading !== null} className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading === "critic" ? "Analyse..." : "Lancer le Template Critic"}</button> : null}</section> : null}

        {critic ? <section className="rounded-2xl border border-blue-200 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Étape 5</p><h2 className="mt-1 text-xl font-semibold">Analyse de la version</h2><p className="mt-3 text-4xl font-bold">{critic.overallQualityScore}/100</p><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-red-50 p-4"><strong>Critiques</strong><div className="mt-2"><IssueList items={critic.criticalIssues} empty="Aucune." /></div></div><div className="rounded-xl bg-amber-50 p-4"><strong>Avertissements</strong><div className="mt-2"><IssueList items={critic.warnings} empty="Aucun." /></div></div><div className="rounded-xl bg-blue-50 p-4"><strong>Suggestions</strong><div className="mt-2"><IssueList items={critic.improvementSuggestions} empty="Aucune." /></div></div></div>{flow.step === "VERSION_CRITIQUED" ? <button type="button" onClick={() => void optimize()} disabled={loading !== null} className="mt-4 rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading === "optimizer" ? "Génération..." : "Générer la proposition d'optimisation"}</button> : null}</section> : null}

        {proposal ? <section className="rounded-2xl border border-violet-200 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Étape 6</p><h2 className="mt-1 text-xl font-semibold">Proposition d'amélioration</h2><div className="mt-4 flex items-center gap-3"><span className="rounded-xl bg-slate-100 px-4 py-3 text-xl font-bold">{proposal.originalScore}</span><span>→</span><span className="rounded-xl bg-violet-700 px-4 py-3 text-xl font-bold text-white">{proposal.projectedScore}</span></div><div className="mt-4 space-y-3">{proposal.changes.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm">Aucun changement déterministe nécessaire.</p> : proposal.changes.map((change, index) => <div key={`${change.path}-${index}`} className="rounded-xl border p-4"><p className="font-semibold">{change.explanation}</p><p className="mt-1 font-mono text-xs text-slate-500">{change.path} · {change.sourceIssueCode}</p><p className="mt-2 text-sm"><span className="text-red-700">Avant: {valueLabel(change.before)}</span><br /><span className="text-emerald-700">Proposé: {valueLabel(change.after)}</span></p></div>)}</div>{flow.step === "OPTIMIZATION_PROPOSED" ? <><label className="mt-4 flex gap-2 rounded-xl border p-4 text-sm"><input type="checkbox" checked={v2Approved} onChange={(event) => setV2Approved(event.target.checked)} />J'approuve explicitement cette proposition et la création de DRAFT v2 non publiée.</label><button type="button" onClick={() => void createV2()} disabled={!v2Approved || loading !== null} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading === "v2" ? "Création..." : "Créer DRAFT v2"}</button></> : null}</section> : null}

        {flow.version2 ? <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Étape 7 terminée</p><h2 className="mt-1 text-2xl font-semibold">Démonstration complète</h2><p className="mt-2 text-sm text-emerald-900">DRAFT v1 et DRAFT v2 sont non publiées. La version source n'a pas été modifiée silencieusement et aucun workflow n'a été exécuté.</p><div className="mt-4 flex flex-wrap gap-2"><Link href={`/templates/${flow.templateId}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Voir le parcours</Link><button type="button" onClick={reset} className="rounded-xl border border-emerald-400 px-4 py-2 text-sm font-medium">Recommencer la démo</button></div></section> : null}
      </div>

      <aside className="rounded-2xl border bg-white p-5 xl:sticky xl:top-6 xl:self-start">
        <h2 className="font-semibold">Audit et provenance</h2>
        <p className="mt-1 text-xs text-slate-500">Résumé visible des objets créés pendant la démonstration.</p>
        {provenance ? <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs"><p><strong>Provider:</strong> {provenance.provider}</p><p><strong>Modèle:</strong> {provenance.model}</p><p><strong>Prompt:</strong> {provenance.promptVersion}</p><p><strong>Langue:</strong> {provenance.language}</p></div> : null}
        <ol className="mt-4 space-y-3">{audit.map((item, index) => <li key={`${item.label}-${index}`} className="border-l-2 border-violet-300 pl-3"><p className="text-sm font-semibold">{item.label}</p><p className="mt-0.5 break-all text-xs text-slate-500">{item.value}</p></li>)}</ol>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Aucune étape de cette démo ne publie un template ou n'exécute un workflow.</div>
      </aside>
    </div>
  );
}
