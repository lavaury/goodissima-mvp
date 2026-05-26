"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import type { AISuggestedAction, AISummary } from "@/lib/ai/types";

type SummaryResponse = {
  provider: string;
  model: string;
  promptVersion: string;
  summary: AISummary;
};

function formatSummary(summary: AISummary, labels: {
  summary: string;
  keyPoints: string;
  risks: string;
  suggestedActions: string;
  missingDocuments: string;
}) {
  return [
    `${labels.summary}:\n${summary.summary}`,
    summary.keyPoints.length ? `${labels.keyPoints}:\n- ${summary.keyPoints.join("\n- ")}` : "",
    summary.risks.length ? `${labels.risks}:\n- ${summary.risks.join("\n- ")}` : "",
    summary.suggestedActions.length
      ? `${labels.suggestedActions}:\n- ${summary.suggestedActions
          .map((action) => `${action.label}: ${action.reason}`)
          .join("\n- ")}`
      : "",
    summary.missingDocuments.length
      ? `${labels.missingDocuments}:\n- ${summary.missingDocuments.join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function AIRelationSummaryPanel({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creatingActionKey, setCreatingActionKey] = useState<string | null>(null);
  const [result, setResult] = useState<SummaryResponse | null>(null);
  const [emptyMessage, setEmptyMessage] = useState("");
  const toast = useToast();
  const { t } = useI18n();

  async function summarize() {
    setLoading(true);

    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ai-summary`, {
        method: "POST",
      });

      if (!res.ok) {
        if (res.status === 422) {
          const payload = (await res.json()) as { message?: string };
          setResult(null);
          setEmptyMessage(payload.message ?? t("ai.summary.empty"));
          return;
        }

        toast.error(t("ai.summary.error"));
        return;
      }

      setEmptyMessage("");
      setResult((await res.json()) as SummaryResponse);
      toast.success(t("ai.summary.generated"));
    } catch {
      toast.error(t("ai.summary.error"));
    } finally {
      setLoading(false);
    }
  }

  async function copySummary() {
    if (!result) return;

    await navigator.clipboard.writeText(formatSummary(result.summary, {
      summary: t("ai.summary.section.summary"),
      keyPoints: t("ai.summary.section.keyPoints"),
      risks: t("ai.summary.section.risks"),
      suggestedActions: t("ai.summary.section.suggestedActions"),
      missingDocuments: t("ai.summary.section.missingDocuments"),
    }));
    toast.success(t("ai.summary.copied"));
  }

  async function createSuggestedAction(action: AISuggestedAction) {
    const key = `${action.type}:${action.label}`;
    setCreatingActionKey(key);

    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/ai-suggested-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        toast.error(t("ai.summary.actionCreateError"));
        return;
      }

      toast.success(t("ai.summary.actionCreated"));
      router.refresh();
    } catch {
      toast.error(t("ai.summary.actionCreateError"));
    } finally {
      setCreatingActionKey(null);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("ai.summary.title")}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {t("ai.summary.disclaimer")}
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
          onClick={summarize}
          disabled={loading}
          title={t("ai.summary.summarizeTooltip")}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? t("ai.summary.loading") : t("ai.summary.summarize")}
        </button>
        <button
          type="button"
          onClick={copySummary}
          disabled={!result}
          title={t("ai.summary.copyTooltip")}
          className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {t("ai.summary.copy")}
        </button>
      </div>

      {emptyMessage ? (
        <div className="mt-4 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-600">
          {emptyMessage}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-3 text-sm">
          <SummaryCard title={t("ai.summary.section.summary")} tone="slate">
            <p className="text-slate-600">{result.summary.summary}</p>
          </SummaryCard>
          <SummaryList
            title={t("ai.summary.section.keyPoints")}
            items={result.summary.keyPoints}
            empty={t("ai.summary.empty.keyPoints")}
          />
          <SummaryList
            title={t("ai.summary.section.risks")}
            items={result.summary.risks}
            empty={t("ai.summary.empty.risks")}
            tone="amber"
          />
          <SummaryList
            title={t("ai.summary.section.missingDocuments")}
            items={result.summary.missingDocuments}
            empty={t("ai.summary.empty.missingDocuments")}
          />
          <SummaryList
            title={t("ai.summary.section.suggestedActions")}
            items={result.summary.suggestedActions}
            empty={t("ai.summary.empty.suggestedActions")}
            renderAction={(item) => {
              const key = `${item.type}:${item.label}`;

              return (
                <div className="rounded-xl border bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{item.label}</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase text-slate-500">{item.type}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void createSuggestedAction(item)}
                      disabled={creatingActionKey === key}
                      className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                    >
                      {creatingActionKey === key
                        ? t("ai.summary.actionCreating")
                        : t("ai.summary.actionCreate")}
                    </button>
                  </div>
                </div>
              );
            }}
          />
          <div className="rounded-xl border border-dashed bg-slate-50 p-3 text-xs text-slate-500">
            {t("ai.summary.futureAction")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  children,
  tone = "white",
}: {
  title: string;
  children: ReactNode;
  tone?: "white" | "slate" | "amber";
}) {
  const classes = {
    white: "border bg-white",
    slate: "border bg-slate-50",
    amber: "border border-amber-200 bg-amber-50",
  };

  return (
    <section className={`rounded-xl p-3 ${classes[tone]}`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SummaryList({
  title,
  items,
  empty,
  tone = "white",
  renderAction,
}: {
  title: string;
  items: string[] | AISuggestedAction[];
  empty: string;
  tone?: "white" | "amber";
  renderAction?: (item: AISuggestedAction) => ReactNode;
}) {
  return (
    <SummaryCard title={title} tone={tone}>
      {items.length ? (
        renderAction ? (
          <div className="space-y-2">
            {(items as AISuggestedAction[]).map((item) => (
              <div key={`${item.type}:${item.label}`}>{renderAction(item)}</div>
            ))}
          </div>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            {(items as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-slate-500">{empty}</p>
      )}
    </SummaryCard>
  );
}
