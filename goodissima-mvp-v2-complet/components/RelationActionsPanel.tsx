"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getRelationActionStatusLabel,
  getRelationActionTypeLabel,
  relationActionTypes,
} from "@/lib/relation-actions";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";

type RelationActionItem = {
  id: string;
  type: string;
  status: string;
  title: string;
  description?: string | null;
  createdByRole: string;
  completedAt?: Date | string | null;
  createdAt: Date | string;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatRelativeDate(date: Date | string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  if (diffHours >= 1) return `Il y a ${diffHours}h`;
  return `Il y a ${diffMinutes} min`;
}

function formatDate(date: Date | string) {
  return dateFormatter.format(new Date(date));
}

async function getApiErrorMessage(res: Response) {
  try {
    const body = await res.json();
    return typeof body.error === "string" ? body.error : "Erreur lors de l'action";
  } catch {
    return "Erreur lors de l'action";
  }
}

function statusClasses(status: string) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export function RelationActionsPanel({
  caseId,
  candidateAccessToken,
  actions,
  editable,
}: {
  caseId: string;
  candidateAccessToken?: string;
  actions: RelationActionItem[];
  editable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "DOCUMENT_REQUEST",
    title: "",
    description: "",
  });
  const visibleActions = editable ? actions : actions.filter((action) => action.status !== "COMPLETED");

  async function createAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);

    const res = await fetch(`/api/cases/${caseId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setCreating(false);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res));
      return;
    }

    setForm({ type: "DOCUMENT_REQUEST", title: "", description: "" });
    toast.success(t("actions.created"));
    router.refresh();
  }

  async function completeAction(actionId: string) {
    setCompletingId(actionId);

    const res = await fetch(`/api/cases/${caseId}/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", candidateAccessToken }),
    });

    setCompletingId(null);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res));
      return;
    }

    toast.success(t("actions.completed"));
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4">
      <div>
        <h2 className="font-semibold">{t("actions.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">
            {editable ? t("actions.subtitleOwner") : t("actions.subtitleCandidate")}
        </p>
      </div>

      {editable ? (
        <form onSubmit={createAction} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3">
          <select
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
          >
            {relationActionTypes.map((type) => (
              <option key={type} value={type}>
                {getRelationActionTypeLabel(type)}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="Titre de la demande"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <textarea
            className="min-h-20 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="Description optionnelle"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {creating ? t("actions.creating") : t("actions.create")}
          </button>
        </form>
      ) : null}

      <div className="mt-4 max-h-[34vh] space-y-3 overflow-y-auto pr-2 lg:max-h-96">
        {visibleActions.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            {editable
              ? t("actions.emptyOwner")
              : t("actions.emptyCandidate")}
          </div>
        ) : (
          visibleActions.map((action) => (
            <article key={action.id} className="rounded-xl border p-3 text-sm transition hover:bg-slate-50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {getRelationActionTypeLabel(action.type)}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(action.status)}`}>
                  {getRelationActionStatusLabel(action.status)}
                </span>
              </div>
              <h3 className="mt-3 font-medium text-slate-900">{action.title}</h3>
              {action.description ? <p className="mt-1 text-slate-600">{action.description}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                {t("actions.createdBy", { role: action.createdByRole })} - {formatRelativeDate(action.createdAt)} ({formatDate(action.createdAt)})
              </p>
              {action.completedAt ? (
                <p className="mt-1 text-xs text-emerald-700">{t("actions.completedAt", { date: formatDate(action.completedAt) })}</p>
              ) : null}
              {editable && action.status !== "COMPLETED" ? (
                <button
                  type="button"
                  onClick={() => void completeAction(action.id)}
                  disabled={completingId === action.id}
                  className="mt-3 rounded-xl border px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-60"
                >
                  {completingId === action.id ? "Validation..." : t("actions.markCompleted")}
                </button>
              ) : null}
              {!editable && action.status !== "COMPLETED" ? (
                <button
                  type="button"
                  onClick={() => void completeAction(action.id)}
                  disabled={completingId === action.id}
                  className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {completingId === action.id
                    ? "Validation..."
                    : action.type === "CONSENT"
                      ? "Accepter"
                      : action.type === "VALIDATION"
                        ? "Valider"
                        : "Marquer comme fait"}
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
