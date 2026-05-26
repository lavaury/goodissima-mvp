"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AIEmptyState } from "@/components/AIEmptyState";
import { useToast } from "@/components/ToastProvider";
import type { AITimelineIntelligence, AITimelineNextBestAction } from "@/lib/ai/types";

type TimelineResponse = {
  provider: string;
  model: string;
  promptVersion: string;
  timeline: AITimelineIntelligence;
};

function formatTimeline(result: TimelineResponse) {
  return [
    `Etat relationnel:\n${result.timeline.timelineStatus}`,
    typeof result.timeline.inactiveSinceDays === "number"
      ? `Inactivite:\n${result.timeline.inactiveSinceDays} jour(s)`
      : "",
    result.timeline.blockers.length ? `Blocages:\n- ${result.timeline.blockers.join("\n- ")}` : "",
    result.timeline.alerts.length ? `Alertes:\n- ${result.timeline.alerts.join("\n- ")}` : "",
    result.timeline.nextBestActions.length
      ? `Recommandations:\n- ${result.timeline.nextBestActions
          .map((action) => `${action.label}: ${action.reason}`)
          .join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function AITimelineIntelligencePanel({ caseId, workspace = false }: { caseId: string; workspace?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [creatingActionKey, setCreatingActionKey] = useState<string | null>(null);
  const [ignoredActions, setIgnoredActions] = useState<string[]>([]);
  const [result, setResult] = useState<TimelineResponse | null>(null);

  async function analyzeTimeline() {
    setLoading(true);

    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ai-timeline`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Analyse timeline indisponible");
        return;
      }

      setResult((await res.json()) as TimelineResponse);
      toast.success("Analyse timeline generee");
    } catch {
      toast.error("Analyse timeline indisponible");
    } finally {
      setLoading(false);
    }
  }

  async function createTimelineAction(action: AITimelineNextBestAction) {
    const key = `${action.type}:${action.label}`;
    setCreatingActionKey(key);

    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ai-timeline-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        toast.error("Action non creee");
        return;
      }

      toast.success("Action creee apres validation humaine");
      router.refresh();
    } catch {
      toast.error("Action non creee");
    } finally {
      setCreatingActionKey(null);
    }
  }

  function ignoreAction(action: AITimelineNextBestAction) {
    setIgnoredActions((current) => [...current, `${action.type}:${action.label}`]);
  }

  async function copyTimeline() {
    if (!result) return;
    await navigator.clipboard.writeText(formatTimeline(result));
    toast.success("Analyse timeline copiee");
  }

  return (
    <section className={workspace ? "h-full" : "rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Analyse IA de la timeline</h2>
          <p className="mt-1 text-xs text-slate-500">
            Recommandations advisory uniquement. Aucune action n'est creee sans clic humain.
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
          onClick={analyzeTimeline}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Analyse..." : result ? "Regenerer la timeline" : "Analyser la timeline"}
        </button>
        <button
          type="button"
          onClick={copyTimeline}
          disabled={!result}
          className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          Copier
        </button>
      </div>

      {!result ? (
        <AIEmptyState
          title="Timeline relationnelle en attente"
          description="Lancez l'analyse pour faire apparaitre les blocages, alertes, evenements utiles et recommandations de suivi."
          suggestions={["Blocages visibles", "Alertes contextualisees", "Actions proposees sans automatisme"]}
        />
      ) : null}

      {result ? (
        <div className={workspace ? "mt-5 grid gap-4 text-sm" : "mt-4 grid gap-3 text-sm"}>
          <TimelineCard title="Etat relationnel">
            <p className="text-slate-700">{result.timeline.timelineStatus}</p>
            {typeof result.timeline.inactiveSinceDays === "number" ? (
              <p className="mt-1 text-xs text-slate-500">
                Inactive depuis {result.timeline.inactiveSinceDays} jour
                {result.timeline.inactiveSinceDays > 1 ? "s" : ""}
              </p>
            ) : null}
          </TimelineCard>

          <TimelineList title="Blocages" items={result.timeline.blockers} empty="Aucun blocage majeur detecte." />
          <TimelineList title="Alertes" items={result.timeline.alerts} empty="Aucune alerte." tone="amber" />

          <TimelineCard title="Prochaines actions recommandees">
            {result.timeline.nextBestActions.length ? (
              <div className="space-y-2">
                {result.timeline.nextBestActions.map((action) => {
                  const key = `${action.type}:${action.label}`;
                  const ignored = ignoredActions.includes(key);

                  return (
                    <div key={key} className="rounded-xl border bg-white p-3">
                      <div className="flex flex-col gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{action.label}</p>
                          <p className="mt-1 text-[11px] font-semibold uppercase text-slate-500">{action.type}</p>
                          <p className="mt-2 text-sm text-slate-600">{action.reason}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void createTimelineAction(action)}
                            disabled={creatingActionKey === key || ignored}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {creatingActionKey === key ? "Creation..." : "Creer une action"}
                          </button>
                          <button
                            type="button"
                            onClick={() => ignoreAction(action)}
                            disabled={ignored}
                            className="rounded-xl border px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
                          >
                            {ignored ? "Ignoree" : "Ignorer"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500">Aucune action recommandee.</p>
            )}
          </TimelineCard>
        </div>
      ) : null}
    </section>
  );
}

function TimelineCard({
  title,
  children,
  tone = "white",
}: {
  title: string;
  children: ReactNode;
  tone?: "white" | "amber";
}) {
  return (
    <section className={`rounded-xl p-3 ${tone === "amber" ? "border border-amber-200 bg-amber-50" : "border bg-slate-50"}`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function TimelineList({
  title,
  items,
  empty,
  tone = "white",
}: {
  title: string;
  items: string[];
  empty: string;
  tone?: "white" | "amber";
}) {
  return (
    <TimelineCard title={title} tone={tone}>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5 text-slate-600">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">{empty}</p>
      )}
    </TimelineCard>
  );
}
