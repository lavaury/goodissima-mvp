"use client";

import { useState } from "react";
import { AIEmptyState } from "@/components/AIEmptyState";
import { useToast } from "@/components/ToastProvider";
import type { AIRiskAnalysis, AIRiskSignal } from "@/lib/ai/types";

type RiskResponse = {
  provider: string;
  model: string;
  promptVersion: string;
  riskAnalysis: AIRiskAnalysis;
};

function formatRiskAnalysis(result: RiskResponse) {
  if (!result.riskAnalysis.riskSignals.length) return "Aucun signal particulier detecte.";

  return result.riskAnalysis.riskSignals
    .map((signal) =>
      [
        `${signal.title} (${signal.severity})`,
        `Type: ${signal.type}`,
        `Explication: ${signal.explanation}`,
        signal.recommendation ? `Recommandation: ${signal.recommendation}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

const severityClasses = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  high: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function AIRiskSignalsPanel({ caseId, workspace = false }: { caseId: string; workspace?: boolean }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [actingSignal, setActingSignal] = useState<string | null>(null);
  const [actedSignals, setActedSignals] = useState<string[]>([]);
  const [result, setResult] = useState<RiskResponse | null>(null);

  async function analyzeRiskSignals() {
    setLoading(true);

    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ai-risk-signals`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Signaux indisponibles");
        return;
      }

      setResult((await res.json()) as RiskResponse);
      toast.success("Signaux IA generes");
    } catch {
      toast.error("Signaux indisponibles");
    } finally {
      setLoading(false);
    }
  }

  async function markHumanAction(signal: AIRiskSignal) {
    const key = `${signal.type}:${signal.title}`;
    setActingSignal(key);

    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ai-risk-signal-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalType: signal.type }),
      });

      if (!res.ok) {
        toast.error("Action non auditee");
        return;
      }

      setActedSignals((current) => [...current, key]);
      toast.success("Action humaine auditee");
    } catch {
      toast.error("Action non auditee");
    } finally {
      setActingSignal(null);
    }
  }

  async function copyRiskAnalysis() {
    if (!result) return;
    await navigator.clipboard.writeText(formatRiskAnalysis(result));
    toast.success("Signaux copies");
  }

  return (
    <section className={workspace ? "h-full" : "rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Signaux IA de confiance</h2>
          <p className="mt-1 text-xs text-slate-500">
            Signaux explicables, sans score cache ni decision automatique.
          </p>
        </div>
        {result ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {result.provider} / {result.model}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={analyzeRiskSignals}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Analyse..." : result ? "Regenerer les signaux" : "Analyser les signaux"}
        </button>
        <button
          type="button"
          onClick={copyRiskAnalysis}
          disabled={!result}
          className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          Copier
        </button>
      </div>

      {!result ? (
        <AIEmptyState
          title="Signaux de confiance non analyses"
          description="L'analyse signale les points de vigilance et recommandations, sans score cache ni decision automatique."
          suggestions={["Severite lisible", "Explications courtes", "Prise en compte auditee"]}
        />
      ) : null}

      {result ? (
        <div className={workspace ? "mt-5 space-y-4 text-sm" : "mt-4 space-y-3 text-sm"}>
          {result.riskAnalysis.riskSignals.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-3 text-slate-500">
              Aucun signal particulier detecte dans le contexte transmis.
            </div>
          ) : null}
          {result.riskAnalysis.riskSignals.map((signal) => {
            const key = `${signal.type}:${signal.title}`;
            const acted = actedSignals.includes(key);

            return (
              <article key={key} className="rounded-xl border bg-slate-50 p-3">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${severityClasses[signal.severity]}`}>
                    {signal.severity}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {signal.type}
                  </span>
                </div>
                <h3 className="mt-3 font-medium text-slate-900">{signal.title}</h3>
                <p className="mt-2 text-slate-600">{signal.explanation}</p>
                {signal.recommendation ? (
                  <p className="mt-2 rounded-lg bg-white p-2 text-slate-700 ring-1 ring-slate-200">
                    {signal.recommendation}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void markHumanAction(signal)}
                  disabled={acted || actingSignal === key}
                  className="mt-3 rounded-xl border px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
                >
                  {acted ? "Action humaine auditee" : actingSignal === key ? "Audit..." : "J'ai pris en compte"}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
