"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  getRelationActionStatusLabel,
  getRelationActionTypeLabel,
  relationActionTypes,
} from "@/lib/relation-actions";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { candidateIdentityRecommendation, candidateIdentityRequestTitle } from "@/lib/candidate-identity";

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

function completionLabel(action: RelationActionItem, editable: boolean) {
  if (editable) return "Marquer comme terminée";
  if (action.type === "CONSENT") return "Accepter";
  if (action.type === "VALIDATION") return "Valider";
  return "Marquer comme fait";
}

function RequestCard({ action, editable, canComplete, disabled, completing, onComplete }: { action: RelationActionItem; editable: boolean; canComplete: boolean; disabled: boolean; completing: boolean; onComplete: () => void }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  return <article onContextMenu={(event) => { if (!canComplete || (event.target as HTMLElement).closest("a, button, input, textarea, select, [contenteditable='true']")) return; event.preventDefault(); if (disclosure.current) disclosure.current.open = true; requestAnimationFrame(() => disclosure.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus()); }} className="relative rounded-xl border p-3 pr-14 text-sm transition hover:bg-slate-50">
    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{getRelationActionTypeLabel(action.type)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(action.status)}`}>{getRelationActionStatusLabel(action.status)}</span></div>
    <h4 className="mt-2 font-semibold text-slate-900">{action.title}</h4>
    {action.description ? <p className="mt-1 line-clamp-2 text-slate-600">{action.description}</p> : null}
    <p className="mt-2 text-xs text-slate-500">{formatRelativeDate(action.createdAt)} · {formatDate(action.createdAt)}</p>
    {canComplete ? <details ref={disclosure} className="absolute right-2 top-2"><summary ref={trigger} aria-label={`Actions pour ${action.title}`} className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border bg-white text-lg font-bold">•••</summary><div role="menu" aria-label={`Actions pour ${action.title}`} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); if (disclosure.current) disclosure.current.open = false; trigger.current?.focus(); } }} className="absolute right-0 z-20 mt-1 w-52 rounded-xl border bg-white p-1 shadow-lg"><button role="menuitem" type="button" disabled={disabled || completing} onClick={onComplete} className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-slate-100 focus:ring-2 focus:ring-cyan-700 disabled:opacity-60">{completing ? "Validation…" : completionLabel(action, editable)}</button></div></details> : null}
  </article>;
}

export function RelationActionsPanel({
  caseId,
  candidateAccessToken,
  disabled = false,
  disabledReason,
  identityRequestRecommended = false,
  actions,
  editable,
}: {
  caseId: string;
  candidateAccessToken?: string;
  disabled?: boolean;
  disabledReason?: string;
  identityRequestRecommended?: boolean;
  actions: RelationActionItem[];
  editable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    type: "DOCUMENT_REQUEST",
    title: "",
    description: "",
  });
  const visibleActions = editable ? actions : actions.filter((action) => action.status !== "COMPLETED");
  const pendingActions = visibleActions.filter((action) => action.status !== "COMPLETED");
  const completedActions = visibleActions.filter((action) => action.status === "COMPLETED");

  function prepareIdentityRequest() {
    setForm({ type: "TASK", title: candidateIdentityRequestTitle, description: candidateIdentityRecommendation });
    setCreateOpen(true);
  }

  useEffect(() => {
    const prepare = () => prepareIdentityRequest();
    window.addEventListener("goodissima:prepare-relation-request", prepare);
    return () => window.removeEventListener("goodissima:prepare-relation-request", prepare);
  }, []);

  useEffect(() => {
    if (createOpen) requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("select, input, textarea, button")?.focus());
  }, [createOpen]);

  async function createAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
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
    setCreateOpen(false);
    requestAnimationFrame(() => createTrigger.current?.focus());
    toast.success(t("actions.created"));
    router.refresh();
  }

  async function completeAction(actionId: string) {
    if (disabled) return;
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
      {disabled ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {disabledReason ?? "Les demandes sont bloquees pour cette relation."}
        </p>
      ) : null}

      {editable ? <div className="mt-4 flex flex-wrap gap-2">
        <button ref={createTrigger} type="button" disabled={disabled} onClick={() => setCreateOpen(true)} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">+ Nouvelle demande</button>
        {identityRequestRecommended ? <button type="button" disabled={disabled} onClick={prepareIdentityRequest} className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60">{candidateIdentityRequestTitle}</button> : null}
      </div> : null}

      {createOpen && editable ? createPortal(<div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setCreateOpen(false); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="new-request-title" className="max-h-[100dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl" onKeyDown={(event) => {
          if (event.key === "Escape" && !creating) { setCreateOpen(false); createTrigger.current?.focus(); }
          if (event.key === "Tab") { const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled)") ?? []); const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
        }}>
          <h2 id="new-request-title" className="text-lg font-bold text-slate-950">Nouvelle demande</h2>
          <form onSubmit={createAction} className="mt-4 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Type<select className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 py-2 font-normal" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{relationActionTypes.map((type) => <option key={type} value={type}>{getRelationActionTypeLabel(type)}</option>)}</select></label>
            <label className="block text-sm font-semibold text-slate-700">Titre<input required className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 py-2 font-normal" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-500">(facultative)</span><textarea className="mt-1 min-h-24 w-full rounded-xl border bg-white px-3 py-2 font-normal" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={creating} onClick={() => { setCreateOpen(false); createTrigger.current?.focus(); }} className="min-h-11 rounded-xl border px-4 py-2 font-semibold">Annuler</button><button type="submit" disabled={creating} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60">{creating ? t("actions.creating") : t("actions.create")}</button></div>
          </form>
        </div>
      </div>, document.body) : null}

      <div className="mt-5 space-y-5">
        <section aria-labelledby="pending-requests-title"><div className="flex items-center justify-between"><h3 id="pending-requests-title" className="text-xs font-bold uppercase tracking-wide text-slate-600">En cours</h3><span className="text-xs text-slate-500">{pendingActions.length}</span></div>
        <div className="mt-2 space-y-2">{pendingActions.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucune demande en cours.</p> : pendingActions.map((action) => (
            <RequestCard key={action.id} action={action} editable={editable} canComplete={action.status !== "COMPLETED"} disabled={disabled} completing={completingId === action.id} onComplete={() => void completeAction(action.id)} />
          ))}</div></section>
        {completedActions.length > 0 ? <details className="rounded-xl border bg-slate-50 p-3"><summary className="min-h-11 cursor-pointer py-2 text-xs font-bold uppercase tracking-wide text-slate-600">Terminées ({completedActions.length})</summary><div className="mt-2 space-y-2">{completedActions.map((action) => <article key={action.id} className="rounded-xl border bg-white p-3 text-sm opacity-80"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{getRelationActionTypeLabel(action.type)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(action.status)}`}>{getRelationActionStatusLabel(action.status)}</span></div><h4 className="mt-2 font-medium">{action.title}</h4><p className="mt-1 text-xs text-slate-500">{action.completedAt ? t("actions.completedAt", { date: formatDate(action.completedAt) }) : formatDate(action.createdAt)}</p></article>)}</div></details> : null}
      </div>
    </section>
  );
}
